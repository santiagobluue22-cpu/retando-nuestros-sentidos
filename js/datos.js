/* Registro de datos: localStorage + cola de envío a Google Apps Script con reintentos.
   No se registra IP, nombre, correo, user-agent ni ningún dato identificable. */
(function () {
  const CLAVE_FILAS = "rns_filas";       // todas las filas de sesiones COMPLETADAS en este dispositivo
  const CLAVE_COLA = "rns_cola";         // filas pendientes de envío a Sheets
  const CLAVE_ENVIADOS = "rns_enviados"; // códigos ya enviados (para pedir retiro si salen después)
  const CLAVE_RETIROS = "rns_retiros";   // códigos cuyo retiro falta notificar
  const CLAVE_SESION = "rns_sesion";     // sesión en curso (para retomar si se recarga)

  const COLUMNAS = [
    "id_registro", "codigo", "timestamp", "tipo_registro", "ronda", "id_estimulo", "medio", "orden",
    "tipo_correcto", "decision", "acierto", "confianza", "coordenadas_x_y", "coord_x_pct", "coord_y_pct",
    "segundo_marcado", "categoria_detalle", "detalle_concreto", "texto", "reproducciones",
    "reproducciones_pista", "tiempo_respuesta_s", "confianza_imagen", "confianza_audio",
    "caso_cierre", "estrategias", "estrategia_no_sensorial", "version_estimulos"
  ];

  function leer(clave, def) {
    try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  }

  function codigoAnonimo() {
    const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1
    const b = new Uint8Array(4); crypto.getRandomValues(b);
    return "P-" + Array.from(b, x => alfabeto[x % alfabeto.length]).join("");
  }

  /* Normaliza una fila a las columnas oficiales (columnas faltantes = ""). */
  function normalizar(f) {
    const o = {};
    COLUMNAS.forEach(c => { o[c] = f[c] === undefined || f[c] === null ? "" : f[c]; });
    return o;
  }

  function aCSV(filas) {
    const esc = v => {
      const s = String(v === undefined || v === null ? "" : v);
      return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lineas = [COLUMNAS.join(",")];
    filas.forEach(f => lineas.push(COLUMNAS.map(c => esc(f[c])).join(",")));
    return "﻿" + lineas.join("\r\n");
  }

  function desdeCSV(texto) {
    texto = texto.replace(/^﻿/, "");
    const filas = []; let campo = "", fila = [], q = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false; }
        else campo += c;
      } else if (c === '"') q = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        fila.push(campo); campo = ""; filas.push(fila); fila = [];
      } else campo += c;
    }
    if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
    if (!filas.length) return [];
    const cab = filas[0];
    return filas.slice(1).filter(r => r.length > 1).map(r => {
      const o = {}; cab.forEach((h, i) => { o[h] = r[i] === undefined ? "" : r[i]; }); return o;
    });
  }

  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo || "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- Envío ---------- */
  let enviando = false;
  const oyentes = [];
  function notificar(estado) { oyentes.forEach(fn => { try { fn(estado); } catch (e) {} }); }

  async function post(cuerpo) {
    const url = (window.CONFIG || {}).ENDPOINT_SHEETS;
    if (!url) return false;
    // text/plain evita la verificación CORS previa; no-cors: la respuesta es opaca,
    // así que si la petición llega se da por enviada (el script descarta duplicados por id_registro).
    await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(cuerpo) });
    return true;
  }

  async function procesarCola() {
    const url = (window.CONFIG || {}).ENDPOINT_SHEETS;
    if (!url || enviando) { notificar(estadoEnvio()); return; }
    if (navigator.onLine === false) { notificar(estadoEnvio()); return; }
    enviando = true;
    try {
      // 1) Retiros pendientes
      let retiros = leer(CLAVE_RETIROS, []);
      for (const cod of retiros.slice()) {
        await post({ accion: "retirar", codigo: cod });
        retiros = retiros.filter(c => c !== cod); escribir(CLAVE_RETIROS, retiros);
      }
      // 2) Filas pendientes, en lotes de 40
      let cola = leer(CLAVE_COLA, []);
      while (cola.length) {
        const lote = cola.slice(0, 40);
        await post({ accion: "guardar", filas: lote });
        const ids = new Set(lote.map(f => f.id_registro));
        cola = leer(CLAVE_COLA, []).filter(f => !ids.has(f.id_registro));
        escribir(CLAVE_COLA, cola);
        const env = new Set(leer(CLAVE_ENVIADOS, [])); lote.forEach(f => env.add(f.codigo));
        escribir(CLAVE_ENVIADOS, Array.from(env));
      }
    } catch (e) {
      // Sin conexión o error de red: se queda en la cola y se reintenta.
    } finally {
      enviando = false;
      notificar(estadoEnvio());
    }
  }

  function estadoEnvio() {
    const url = (window.CONFIG || {}).ENDPOINT_SHEETS;
    const pendientes = leer(CLAVE_COLA, []).length;
    if (!url) return { modo: "local", pendientes };
    return { modo: "sheets", pendientes };
  }

  /* Guarda una sesión COMPLETA: local + cola. */
  function guardarSesion(filas) {
    const norm = filas.map(normalizar);
    const todas = leer(CLAVE_FILAS, []);
    const ids = new Set(todas.map(f => f.id_registro));
    norm.forEach(f => { if (!ids.has(f.id_registro)) todas.push(f); });
    escribir(CLAVE_FILAS, todas);
    if ((window.CONFIG || {}).ENDPOINT_SHEETS) {
      const cola = leer(CLAVE_COLA, []); norm.forEach(f => cola.push(f)); escribir(CLAVE_COLA, cola);
      procesarCola();
    }
  }

  /* Retiro: borra todo rastro local del código y, si ya se había enviado, pide borrarlo en Sheets. */
  function retirar(codigo) {
    if (!codigo) return;
    escribir(CLAVE_FILAS, leer(CLAVE_FILAS, []).filter(f => f.codigo !== codigo));
    escribir(CLAVE_COLA, leer(CLAVE_COLA, []).filter(f => f.codigo !== codigo));
    const enviados = leer(CLAVE_ENVIADOS, []);
    if (enviados.includes(codigo) && (window.CONFIG || {}).ENDPOINT_SHEETS) {
      const r = leer(CLAVE_RETIROS, []); if (!r.includes(codigo)) r.push(codigo); escribir(CLAVE_RETIROS, r);
      procesarCola();
    }
    escribir(CLAVE_ENVIADOS, enviados.filter(c => c !== codigo));
    const s = leer(CLAVE_SESION, null);
    if (s && s.codigo === codigo) localStorage.removeItem(CLAVE_SESION);
  }

  function iniciarReintentos() {
    const seg = ((window.CONFIG || {}).REINTENTO_SEGUNDOS || 20) * 1000;
    window.addEventListener("online", procesarCola);
    setInterval(procesarCola, seg);
    procesarCola();
  }

  window.Datos = {
    COLUMNAS, uuid, codigoAnonimo, normalizar, aCSV, desdeCSV, descargar,
    guardarSesion, retirar, procesarCola, iniciarReintentos, estadoEnvio,
    alCambiarEnvio: fn => oyentes.push(fn),
    filasLocales: () => leer(CLAVE_FILAS, []),
    leerSesion: () => leer(CLAVE_SESION, null),
    escribirSesion: s => escribir(CLAVE_SESION, s),
    borrarSesion: () => { try { localStorage.removeItem(CLAVE_SESION); } catch (e) {} }
  };
})();
