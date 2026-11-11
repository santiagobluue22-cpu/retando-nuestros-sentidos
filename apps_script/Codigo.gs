/**
 * Retando nuestros sentidos: receptor de respuestas en Google Sheets.
 * Instalación: ver README.md, sección «Conectar Google Sheets».
 *
 * - doPost {accion:"guardar", filas:[...]}  agrega las filas (no duplica id_registro).
 * - doPost {accion:"retirar", codigo:"P-XXXX"} borra todas las filas de ese código (botón «Salir»).
 * - doGet ?accion=leer&clave=...             devuelve todas las filas en JSON (para panel.html).
 * No se guarda IP, correo ni ningún dato identificable (Apps Script tampoco los entrega en modo anónimo).
 */
const CLAVE_LECTURA = "CAMBIA_ESTA_CLAVE";   // debe coincidir con CLAVE_PANEL de config.js
const HOJA = "respuestas";
const COLUMNAS = [
  "id_registro", "codigo", "timestamp", "tipo_registro", "ronda", "id_estimulo", "medio", "orden",
  "tipo_correcto", "decision", "acierto", "confianza", "coordenadas_x_y", "coord_x_pct", "coord_y_pct",
  "segundo_marcado", "categoria_detalle", "detalle_concreto", "texto", "reproducciones",
  "reproducciones_pista", "tiempo_respuesta_s", "confianza_imagen", "confianza_audio",
  "caso_cierre", "estrategias", "estrategia_no_sensorial", "version_estimulos", "recibido"
];

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(HOJA);
  if (!h) h = ss.insertSheet(HOJA);
  if (h.getLastRow() === 0) { h.appendRow(COLUMNAS); h.setFrozenRows(1); }
  return h;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const datos = JSON.parse(e.postData.contents);
    const h = hoja_();
    if (datos.accion === "guardar") {
      const n = h.getLastRow();
      const existentes = new Set(n > 1 ? h.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0])) : []);
      const ahora = new Date().toISOString();
      const nuevas = (datos.filas || [])
        .filter(f => f && f.id_registro && !existentes.has(String(f.id_registro)))
        .map(f => COLUMNAS.map(c => c === "recibido" ? ahora : (f[c] === undefined || f[c] === null ? "" : String(f[c]).slice(0, 500))));
      if (nuevas.length) h.getRange(h.getLastRow() + 1, 1, nuevas.length, COLUMNAS.length).setValues(nuevas);
      return json_({ ok: true, agregadas: nuevas.length });
    }
    if (datos.accion === "retirar" && /^P-[A-Z0-9]{4}$/.test(datos.codigo || "")) {
      const valores = h.getDataRange().getValues();
      let borradas = 0;
      for (let i = valores.length - 1; i >= 1; i--) {
        if (String(valores[i][1]) === datos.codigo) { h.deleteRow(i + 1); borradas++; }
      }
      return json_({ ok: true, borradas });
    }
    return json_({ ok: false, error: "accion no valida" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion !== "leer") return json_({ ok: true, mensaje: "Endpoint activo" });
  if (p.clave !== CLAVE_LECTURA) return json_({ ok: false, error: "clave incorrecta" });
  const v = hoja_().getDataRange().getValues();
  const cab = v[0];
  const filas = v.slice(1).map(r => { const o = {}; cab.forEach((c, i) => { o[c] = r[i]; }); return o; });
  return json_({ ok: true, filas });
}
