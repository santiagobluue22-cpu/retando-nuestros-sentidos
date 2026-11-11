/* Flujo de la experiencia "Retando nuestros sentidos". */
(function () {
  const CFG = window.CONFIG || {};
  const MAX_REP = CFG.MAX_REPRODUCCIONES || 3;
  const app = document.getElementById("app");
  const $progreso = document.getElementById("progreso");
  const $codigo = document.getElementById("codigo-barra");
  const $salir = document.getElementById("btn-salir");

  const CATEGORIAS = {
    imagen: [
      ["manos", "Manos / dedos"], ["texto", "Texto o letreros"], ["luces", "Luces y sombras"],
      ["texturas", "Texturas / piel"], ["fondo", "Fondo y bordes"], ["simetria", "Simetría / repetición"],
      ["fisica", "Física imposible"], ["intuicion", "Fue intuición, no sé decir"]
    ],
    audio: [
      ["respiracion", "Respiración y pausas"], ["entonacion", "Entonación o ritmo demasiado parejo"],
      ["pronunciacion", "Pronunciación o acento extraño"], ["ambiente", "Ruido de fondo o ambiente que no encaja"],
      ["cortes", "Cortes o transiciones bruscas"], ["timbre", "Timbre metálico o «limpio de más»"],
      ["emocion", "Emoción que no corresponde al contenido"], ["intuicion", "Fue intuición, no sé decir"]
    ]
  };

  let DATOS = null;      // contenido de estimulos.json
  let SECUENCIA = [];    // estímulos de ronda 1 y 2 en orden
  let S = null;          // estado de la sesión
  let limpiar = [];      // funciones de limpieza de la pantalla actual

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ahora = () => new Date().toISOString();
  function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; }
  function pintar(html) {
    limpiar.forEach(fn => { try { fn(); } catch (e) {} }); limpiar = [];
    app.innerHTML = ""; app.appendChild(h(html)); window.scrollTo(0, 0);
  }
  function guardar() { if (S) Datos.escribirSesion(S); }
  function progreso(txt) { $progreso.textContent = txt || ""; }
  function barraCodigo() { $codigo.textContent = S ? S.codigo : ""; }

  function escala(id, pregunta, minTxt, maxTxt, valor) {
    return `<div class="escala" data-escala="${id}">
      <p><b>${pregunta}</b></p>
      <div class="opciones" role="radiogroup" aria-label="${esc(pregunta)}">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${valor === n}" data-v="${n}" class="${valor === n ? "activo" : ""}">${n}</button>`).join("")}
      </div>
      <div class="extremos"><span>1 · ${minTxt}</span><span>5 · ${maxTxt}</span></div>
    </div>`;
  }
  function conectarEscala(raiz, id, alElegir) {
    const cont = raiz.querySelector(`[data-escala="${id}"]`);
    cont.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      cont.querySelectorAll("button").forEach(x => { x.classList.remove("activo"); x.setAttribute("aria-checked", "false"); });
      b.classList.add("activo"); b.setAttribute("aria-checked", "true");
      alElegir(Number(b.dataset.v));
    }));
  }

  function modal(html, botones) {
    const f = document.createElement("div"); f.className = "modal-fondo";
    f.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}<div class="botones"></div></div>`;
    const cont = f.querySelector(".botones");
    botones.forEach(([txt, clase, fn]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn " + (clase || ""); b.textContent = txt;
      b.addEventListener("click", () => { f.remove(); fn && fn(); }); cont.appendChild(b);
    });
    document.body.appendChild(f);
    return f;
  }

  /* ---------- carga ---------- */
  async function cargar() {
    try {
      const r = await fetch("estimulos.json", { cache: "no-cache" });
      DATOS = await r.json();
    } catch (e) {
      app.innerHTML = `<p class="aviso error">No se pudo cargar <code>estimulos.json</code>. Si abriste el archivo directamente, usa un servidor local (ver README).</p>`;
      return;
    }
    const orden = (a, b) => a.orden - b.orden;
    SECUENCIA = [
      ...DATOS.estimulos.filter(e => Number(e.ronda) === 1).sort(orden),
      ...DATOS.estimulos.filter(e => Number(e.ronda) === 2).sort(orden)
    ];
    validar();
    $salir.classList.remove("oculto");
    $salir.addEventListener("click", pedirSalida);
    Datos.iniciarReintentos();

    const previa = Datos.leerSesion();
    if (previa && previa.codigo && !previa.terminado) {
      S = previa; barraCodigo();
      modal(`<h2>Tienes una sesión sin terminar</h2><p>Código <b>${esc(S.codigo)}</b>. ¿Quieres continuar donde ibas?</p>`, [
        ["Continuar", "primario", () => irA(S.paso)],
        ["Empezar de nuevo (se descartan esas respuestas)", "secundario", () => { Datos.retirar(S.codigo); S = null; barraCodigo(); pantallaConsentimiento(); }]
      ]);
    } else {
      if (previa) Datos.borrarSesion();
      pantallaConsentimiento();
    }
  }

  function validar() {
    const prob = [];
    [1, 2].forEach(r => {
      const e = SECUENCIA.filter(x => Number(x.ronda) === r);
      const im = e.filter(x => x.medio === "imagen").length, au = e.filter(x => x.medio === "audio").length;
      if (im !== 4 || au !== 3) prob.push(`Ronda ${r}: ${im} imágenes y ${au} audios (se esperaban 4 y 3).`);
    });
    const ids = new Set();
    DATOS.estimulos.forEach(e => {
      if (ids.has(e.id)) prob.push("id repetido: " + e.id); ids.add(e.id);
      if (!["real", "ia"].includes(e.tipo)) prob.push(e.id + ": tipo debe ser real o ia");
      if (!e.zona_clave) prob.push(e.id + ": falta zona_clave");
    });
    if (prob.length) console.warn("Revisión de estimulos.json:\n" + prob.join("\n"));
  }

  function irA(paso) {
    const m = {
      consentimiento: pantallaConsentimiento, audifonos: pantallaAudifonos, confianza_ini: pantallaConfianzaInicial,
      intro: pantallaIntroRonda, estimulo: pantallaEstimulo, estrategias: pantallaEstrategias, caso: pantallaCaso,
      confianza_fin: pantallaConfianzaFinal, revelacion: pantallaRevelacion
    };
    (m[paso] || pantallaConsentimiento)();
  }
  function avanzar(paso) { S.paso = paso; guardar(); irA(paso); }

  /* ---------- salir ---------- */
  function pedirSalida() {
    const conDatos = !!S;
    modal(`<h2>¿Salir de la experiencia?</h2>
      <p>${conDatos ? "Se borrarán todas tus respuestas de este dispositivo y no se usarán en el estudio." : "Todavía no se ha guardado ningún dato."}</p>`, [
      ["Sí, salir y borrar mis datos", "primario", () => {
        if (S) Datos.retirar(S.codigo);
        Datos.borrarSesion(); S = null; barraCodigo();
        pintar(`<div class="tarjeta"><h1>Saliste de la experiencia</h1><p>Tus respuestas fueron descartadas. Gracias por tu tiempo.</p>
          <button class="btn" id="volver">Volver al inicio</button></div>`);
        progreso("");
        app.querySelector("#volver").addEventListener("click", pantallaConsentimiento);
      }],
      ["Cancelar", "secundario"]
    ]);
  }

  /* ---------- 1. consentimiento ---------- */
  function pantallaConsentimiento() {
    S = null; barraCodigo(); progreso("Inicio");
    pintar(`
      <h1>¿Basta con mirar o escuchar algo para saber si es real?</h1>
      <div class="tarjeta">
        <p>Vas a ver imágenes y escuchar audios cortos, en dos rondas. En cada uno decidirás si es real o si fue generado con IA, y nos mostrarás qué detalle te hizo decidir. Luego verás una pista.</p>
        <p>La experiencia dura entre 12 y 15 minutos y es <b>anónima</b>: no pedimos tu nombre, correo ni ningún dato personal, y no usamos tu micrófono. Solo verás un código al azar.</p>
        <p>Puedes retirarte cuando quieras con el botón <b>Salir</b>, que borra tus respuestas.</p>
        <p class="suave">Los archivos son material educativo. Algunos fueron generados con IA y no muestran personas ni lugares reales identificables. <b>No los compartas fuera de esta experiencia.</b></p>
      </div>
      <label class="check"><input type="checkbox" id="acepto"> <span>Soy mayor de 18 años y acepto participar.</span></label>
      <button class="btn primario" id="empezar" disabled>Empezar</button>
    `);
    const c = app.querySelector("#acepto"), b = app.querySelector("#empezar");
    c.addEventListener("change", () => { b.disabled = !c.checked; });
    b.addEventListener("click", () => {
      Reproductor.desbloquear();
      S = {
        codigo: Datos.codigoAnonimo(), inicio: ahora(), inicioMs: Date.now(), paso: "audifonos",
        idx: 0, casoIdx: 0, respuestas: [], confIni: {}, confFin: {}, cierre: [], reflexion: "", terminado: false
      };
      barraCodigo(); guardar(); pantallaAudifonos();
    });
  }

  /* ---------- 1b. audífonos y prueba de sonido ---------- */
  function pantallaAudifonos() {
    progreso("Preparación");
    pintar(`
      <div class="tarjeta">
        <p class="suave">Tu código anónimo es</p>
        <div class="codigo-grande">${esc(S.codigo)}</div>
        <p class="suave" style="text-align:center">No necesitas anotarlo. Sirve para identificar tus respuestas sin saber quién eres.</p>
      </div>
      <h2>🎧 Ponte audífonos</h2>
      <p>Te recomendamos usar audífonos: algunos detalles se oyen mejor así. Sube el volumen a un nivel cómodo y quita el modo silencio del celular.</p>
      <div id="prueba"></div>
      <label class="check"><input type="checkbox" id="oigo"> <span>Escucho bien el sonido de prueba.</span></label>
      <button class="btn primario" id="seguir" disabled>Continuar</button>
      <p class="suave">Si no escuchas nada: revisa que el celular no esté en silencio (en iPhone, el interruptor lateral) y vuelve a tocar «Reproducir».</p>
    `);
    const rep = Reproductor.crear({ url: "media/prueba_sonido.mp3", max: 0 });
    app.querySelector("#prueba").appendChild(rep.el); limpiar.push(rep.destruir);
    const c = app.querySelector("#oigo"), b = app.querySelector("#seguir");
    c.addEventListener("change", () => { b.disabled = !c.checked; });
    b.addEventListener("click", () => avanzar("confianza_ini"));
  }

  /* ---------- 2. confianza inicial ---------- */
  function pantallaConfianza(final) {
    progreso(final ? "Antes de terminar" : "Antes de empezar");
    const v = final ? S.confFin : S.confIni;
    pintar(`
      <h2>${final ? "Ahora que terminaste las rondas…" : "Antes de empezar"}</h2>
      <div class="tarjeta">
        ${escala("img", "¿Qué tan seguro/a estás de poder distinguir una IMAGEN real de una generada con IA solo con mirarla?", "Nada seguro/a", "Totalmente seguro/a", v.imagen)}
      </div>
      <div class="tarjeta">
        ${escala("aud", "¿Qué tan seguro/a estás de poder distinguir un AUDIO real de uno generado con IA solo con escucharlo?", "Nada seguro/a", "Totalmente seguro/a", v.audio)}
      </div>
      ${final ? `<div class="tarjeta"><p><b>¿Qué harías distinto la próxima vez que veas o escuches algo dudoso?</b></p>
        <textarea id="reflexion" maxlength="280" placeholder="Escribe una o dos frases (opcional)">${esc(S.reflexion)}</textarea><div class="contador"><span id="cnt">0</span>/280</div></div>` : ""}
      <button class="btn primario" id="seguir" disabled>Continuar</button>
    `);
    const b = app.querySelector("#seguir");
    const ok = () => { b.disabled = !(v.imagen && v.audio); };
    conectarEscala(app, "img", n => { v.imagen = n; ok(); guardar(); });
    conectarEscala(app, "aud", n => { v.audio = n; ok(); guardar(); });
    ok();
    if (final) {
      const t = app.querySelector("#reflexion"), cnt = app.querySelector("#cnt");
      const up = () => { cnt.textContent = t.value.length; S.reflexion = t.value; };
      t.addEventListener("input", up); up();
    }
    b.addEventListener("click", () => {
      if (final) { S.finMs = Date.now(); completar(); avanzar("revelacion"); }
      else { S.idx = 0; avanzar("intro"); }
    });
  }
  const pantallaConfianzaInicial = () => pantallaConfianza(false);
  const pantallaConfianzaFinal = () => pantallaConfianza(true);

  /* ---------- 3. rondas ---------- */
  function pantallaIntroRonda() {
    const e = SECUENCIA[S.idx]; const r = Number(e.ronda);
    progreso("Ronda " + r);
    pintar(r === 1 ? `
      <h1>Ronda 1</h1>
      <div class="tarjeta">
        <p>Verás <b>4 imágenes</b> y escucharás <b>3 audios</b>, intercalados. En cada uno:</p>
        <ol>
          <li><b>Observa o escucha.</b> Puedes ampliar las imágenes. Cada audio se puede reproducir hasta ${MAX_REP} veces.</li>
          <li><b>Decide</b> si es real o generado con IA, y qué tan seguro/a estás.</li>
          <li><b>Señala el detalle</b> que te hizo decidir.</li>
          <li><b>Mira la pista</b>: te mostramos la respuesta y qué rastros revisar.</li>
        </ol>
        <p class="suave">Hay contenido real y contenido generado. No hay trampa en la proporción.</p>
      </div>
      <button class="btn primario" id="seguir">Empezar la ronda 1</button>` : `
      <h1>Ronda 2</h1>
      <div class="tarjeta">
        <p>Otros <b>4 imágenes</b> y <b>3 audios</b>, distintos a los de la ronda 1. <b>Esta ronda es más difícil.</b></p>
        <p>Usa lo que aprendiste en las pistas, pero recuerda que un detalle "raro" no siempre quiere decir que algo sea falso.</p>
      </div>
      <button class="btn primario" id="seguir">Empezar la ronda 2</button>`);
    app.querySelector("#seguir").addEventListener("click", () => avanzar("estimulo"));
  }

  function etiquetaProgreso(e) {
    const r = Number(e.ronda);
    const enRonda = SECUENCIA.filter(x => Number(x.ronda) === r);
    return `Ronda ${r} · ${enRonda.indexOf(e) + 1} de ${enRonda.length}`;
  }

  function pantallaEstimulo() {
    const e = SECUENCIA[S.idx];
    if (!e) { avanzar("estrategias"); return; }
    progreso(etiquetaProgreso(e));
    const r = { e, t0: Date.now(), decision: null, confianza: null, x: null, y: null, seg: null, cat: null, texto: "" };
    if (e.medio === "imagen") cicloImagen(e, r); else cicloAudio(e, r);
  }

  function siguienteEstimulo() {
    const prev = SECUENCIA[S.idx];
    S.idx++;
    const sig = SECUENCIA[S.idx];
    if (!sig) avanzar("estrategias");
    else if (Number(sig.ronda) !== Number(prev.ronda)) avanzar("intro");
    else avanzar("estimulo");
  }

  function registrar(r, reproducciones, repPista) {
    const e = r.e, acierto = r.decision === e.tipo;
    const fila = {
      id_registro: Datos.uuid(), codigo: S.codigo, timestamp: ahora(), tipo_registro: "estimulo",
      ronda: Number(e.ronda), id_estimulo: e.id, medio: e.medio, orden: e.orden, tipo_correcto: e.tipo,
      decision: r.decision, acierto: acierto ? 1 : 0, confianza: r.confianza,
      coordenadas_x_y: e.medio === "imagen" ? `${r.x};${r.y}` : "",
      coord_x_pct: e.medio === "imagen" ? r.x : "", coord_y_pct: e.medio === "imagen" ? r.y : "",
      segundo_marcado: e.medio === "audio" ? r.seg : "",
      categoria_detalle: r.cat, detalle_concreto: r.cat === "intuicion" ? 0 : 1,
      texto: (r.texto || "").trim().slice(0, 140),
      reproducciones: e.medio === "audio" ? reproducciones : "",
      reproducciones_pista: "",
      tiempo_respuesta_s: Math.round((Date.now() - r.t0) / 100) / 10,
      version_estimulos: DATOS.version || CFG.VERSION_ESTIMULOS || ""
    };
    S.respuestas = S.respuestas.filter(x => x.id_estimulo !== e.id);
    S.respuestas.push(fila); guardar();
    return fila;
  }

  /* Bloque común: decisión + confianza */
  function htmlDecision(medio) {
    const g = medio === "imagen" ? "Generada con IA" : "Generado con IA";
    return `<div class="tarjeta" id="bloque-decision">
      <p><b>¿${medio === "imagen" ? "Esta imagen" : "Este audio"} es real o ${medio === "imagen" ? "generada" : "generado"} con IA?</b></p>
      <div class="fila">
        <button type="button" class="btn eleccion real" data-d="real">Real</button>
        <button type="button" class="btn eleccion ia" data-d="ia">${g}</button>
      </div>
      ${escala("conf", "¿Qué tan seguro/a estás de tu decisión?", "Nada", "Totalmente", null)}
      <button class="btn primario" id="a-senalar" disabled>Siguiente: señalar el detalle</button>
    </div>`;
  }
  function conectarDecision(r, alSeguir) {
    const b = app.querySelector("#a-senalar");
    const ok = () => { b.disabled = !(r.decision && r.confianza); };
    app.querySelectorAll("[data-d]").forEach(x => x.addEventListener("click", () => {
      app.querySelectorAll("[data-d]").forEach(y => y.classList.remove("activo"));
      x.classList.add("activo"); r.decision = x.dataset.d; ok();
    }));
    conectarEscala(app, "conf", n => { r.confianza = n; ok(); });
    b.addEventListener("click", alSeguir);
  }

  function htmlSenalar(medio) {
    return `<div class="tarjeta" id="bloque-senalar">
      <p><b>${medio === "imagen" ? "1. Toca en la imagen el detalle que te hizo decidir." : "1. Toca en la onda el momento que te hizo decidir."}</b></p>
      <p class="suave">${medio === "imagen" ? "Si fue intuición, toca la zona que más miraste." : "Si fue intuición, toca la parte que más te llamó la atención. Puedes volver a escuchar si te quedan reproducciones."}</p>
      <p id="estado-marca" class="suave">Aún no has marcado.</p>
      <p><b>2. ¿Qué tipo de detalle fue?</b></p>
      <div class="chips" role="radiogroup">
        ${CATEGORIAS[medio].map(([id, t]) => `<button type="button" class="chip" role="radio" data-cat="${id}">${t}</button>`).join("")}
      </div>
      <p><b>3. ¿Algo más?</b> <span class="suave">(opcional)</span></p>
      <input type="text" id="texto" maxlength="140" placeholder="Ej.: las sombras van en direcciones distintas">
      <button class="btn primario" id="confirmar" disabled>Confirmar y ver la pista</button>
    </div>`;
  }
  function conectarSenalar(r, alConfirmar) {
    const b = app.querySelector("#confirmar");
    const ok = () => { b.disabled = !(r.cat && (r.x !== null || r.seg !== null)); };
    app.querySelectorAll("[data-cat]").forEach(x => x.addEventListener("click", () => {
      app.querySelectorAll("[data-cat]").forEach(y => { y.classList.remove("activo"); y.setAttribute("aria-checked", "false"); });
      x.classList.add("activo"); x.setAttribute("aria-checked", "true"); r.cat = x.dataset.cat; ok();
    }));
    app.querySelector("#texto").addEventListener("input", ev => { r.texto = ev.target.value; });
    b.addEventListener("click", alConfirmar);
    return ok;
  }

  function htmlPista(e, fila) {
    const esIA = e.tipo === "ia";
    const ok = Number(fila.acierto) === 1;
    return `<div class="tarjeta">
      <div class="veredicto ${e.tipo}">${esIA ? (e.medio === "imagen" ? "Generada con IA" : "Generado con IA") : (e.medio === "imagen" ? "Es una foto real" : "Es una grabación real")}</div>
      <p class="resultado ${ok ? "ok" : "no"}">${ok ? "✓ Acertaste." : "✗ Esta vez no."} Tu confianza: ${fila.confianza}/5.</p>
      <h3>${esIA ? "Los rastros" : "Por qué lo «raro» es normal aquí"}</h3>
      <div class="pista-texto">${esc(e.explicacion_pista)}</div>
      <p class="suave">Explicación preparada por el equipo con apoyo de IA y revisada a mano.</p>
      ${!esIA ? `<p class="suave">Recuerda: casi todo lo que vemos y oímos a diario es real. Un detalle extraño no basta para decir que algo es falso.</p>` : `<p class="suave">Estos rastros ayudan, pero no son garantía: las herramientas mejoran cada mes.</p>`}
    </div>`;
  }

  /* ----- Imagen ----- */
  function abrirVisor(src, alListo, txtListo) {
    let zoom = 1;
    const v = document.createElement("div"); v.className = "visor";
    v.innerHTML = `<div class="area"><img alt="Imagen a observar" src="${esc(src)}"></div>
      <div class="controles">
        <button type="button" data-z="-1" aria-label="Alejar">−</button>
        <span class="nivel">100%</span>
        <button type="button" data-z="1" aria-label="Acercar">+</button>
        <button type="button" class="listo">${txtListo || "Ya observé →"}</button>
      </div>`;
    const area = v.querySelector(".area"), img = v.querySelector("img"), nivel = v.querySelector(".nivel");
    function aplicar() {
      const W = area.clientWidth, H = area.clientHeight, iw = img.naturalWidth || W, ih = img.naturalHeight || H;
      const base = Math.min(W / iw, H / ih);
      const cx = (area.scrollLeft + W / 2) / (area.scrollWidth || 1), cy = (area.scrollTop + H / 2) / (area.scrollHeight || 1);
      img.style.width = (iw * base * zoom) + "px"; img.style.height = (ih * base * zoom) + "px";
      nivel.textContent = Math.round(zoom * 100) + "%";
      area.scrollLeft = cx * area.scrollWidth - W / 2; area.scrollTop = cy * area.scrollHeight - H / 2;
    }
    img.addEventListener("load", aplicar);
    v.querySelectorAll("[data-z]").forEach(b => b.addEventListener("click", () => {
      zoom = Math.min(4, Math.max(1, zoom + Number(b.dataset.z))); aplicar();
    }));
    let ultimo = 0;
    img.addEventListener("click", () => { const t = Date.now(); if (t - ultimo < 350) { zoom = zoom >= 2.5 ? 1 : zoom + 1.5; aplicar(); } ultimo = t; });
    window.addEventListener("resize", aplicar);
    v.querySelector(".listo").addEventListener("click", () => { window.removeEventListener("resize", aplicar); v.remove(); alListo && alListo(); });
    document.body.appendChild(v);
    if (img.complete) aplicar();
    limpiar.push(() => v.remove());
    return v;
  }

  function cicloImagen(e, r) {
    // A. Observar (pantalla completa)
    pintar(`<p class="suave">Observa la imagen con calma. Puedes acercarla con + o con doble toque.</p>`);
    abrirVisor(e.archivo, decidir, "Ya observé →");

    function decidir() {
      pintar(`
        <div class="lienzo-img"><div class="marco" id="marco"><img src="${esc(e.archivo)}" alt="Imagen del estímulo"></div></div>
        <button class="btn secundario" id="ampliar">🔍 Ver en pantalla completa</button>
        ${htmlDecision("imagen")}`);
      app.querySelector("#ampliar").addEventListener("click", () => abrirVisor(e.archivo, null, "Cerrar"));
      conectarDecision(r, senalar);
    }

    function senalar() {
      pintar(`
        <div class="lienzo-img"><div class="marco marcable" id="marco"><img src="${esc(e.archivo)}" alt="Toca el detalle que te hizo decidir" draggable="false"></div></div>
        <button class="btn secundario" id="ampliar">🔍 Ver en pantalla completa</button>
        ${htmlSenalar("imagen")}`);
      app.querySelector("#ampliar").addEventListener("click", () => abrirVisor(e.archivo, null, "Cerrar"));
      const ok = conectarSenalar(r, () => pista(registrar(r)));
      const marco = app.querySelector("#marco"), img = marco.querySelector("img");
      img.addEventListener("click", ev => {
        const b = img.getBoundingClientRect();
        r.x = Math.round(Math.min(100, Math.max(0, (ev.clientX - b.left) / b.width * 100)) * 10) / 10;
        r.y = Math.round(Math.min(100, Math.max(0, (ev.clientY - b.top) / b.height * 100)) * 10) / 10;
        let m = marco.querySelector(".marcador");
        if (!m) { m = document.createElement("div"); m.className = "marcador"; marco.appendChild(m); }
        m.style.left = r.x + "%"; m.style.top = r.y + "%";
        app.querySelector("#estado-marca").textContent = "Marcado ✓ (puedes tocar otra vez para cambiarlo).";
        ok();
      });
    }

    function pista(fila) {
      const z = e.zona_clave || {};
      pintar(`
        <div class="lienzo-img"><div class="marco" id="marco"><img src="${esc(e.archivo)}" alt="Imagen con la zona clave resaltada">
          <div class="zona" id="zona" style="left:${z.x}%;top:${z.y}%"></div>
          <div class="marcador tuyo" style="left:${r.x}%;top:${r.y}%"></div>
        </div></div>
        <div class="leyenda"><span><i style="border:2px dashed var(--resalte)"></i>Zona clave</span><span><i style="background:#6fd3ff"></i>Tu marca</span></div>
        ${htmlPista(e, fila)}
        <button class="btn primario" id="siguiente">Siguiente</button>`);
      const img = app.querySelector("#marco img"), zona = app.querySelector("#zona");
      const tam = () => { const d = (z.radio || 10) * 2 / 100 * img.clientWidth; zona.style.width = d + "px"; zona.style.height = d + "px"; };
      img.complete ? tam() : img.addEventListener("load", tam);
      window.addEventListener("resize", tam); limpiar.push(() => window.removeEventListener("resize", tam));
      app.querySelector("#siguiente").addEventListener("click", siguienteEstimulo);
    }
  }

  /* ----- Audio ----- */
  function cicloAudio(e, r) {
    pintar(`
      <h2>Escucha con atención</h2>
      <p class="suave">Puedes reproducirlo hasta ${MAX_REP} veces en total (contando las que uses al señalar).</p>
      <div id="rep"></div>
      <div id="panel"><button class="btn primario" id="listo" disabled>Ya escuché, quiero decidir</button></div>`);
    const rep = Reproductor.crear({
      url: e.archivo, max: MAX_REP,
      alCambiar: st => { const b = app.querySelector("#listo"); if (b) b.disabled = st.reproducciones < 1; }
    });
    app.querySelector("#rep").appendChild(rep.el);
    limpiar.push(rep.destruir);
    const panel = app.querySelector("#panel");
    app.querySelector("#listo").addEventListener("click", decidir);

    function decidir() {
      panel.innerHTML = ""; panel.appendChild(h(htmlDecision("audio")));
      conectarDecision(r, senalar);
    }
    function senalar() {
      panel.innerHTML = ""; panel.appendChild(h(htmlSenalar("audio")));
      const ok = conectarSenalar(r, () => { rep.detener(); rep.desactivarMarcado(); pista(registrar(r, rep.reproducciones)); });
      rep.activarMarcado(seg => {
        r.seg = seg;
        app.querySelector("#estado-marca").textContent = `Marcaste el segundo ${seg.toFixed(1)} ✓ (toca otra vez para cambiarlo).`;
        ok();
      });
      app.querySelector("h2").scrollIntoView({ block: "start" });
    }
    function pista(fila) {
      const z = e.zona_clave || {};
      app.querySelector("h2").textContent = "La pista";
      app.querySelector("h2").nextElementSibling.textContent = "La franja amarilla es el fragmento clave. Tu marca es la línea azul.";
      rep.mostrarFragmento(Number(z.inicio_s) || 0, Number(z.fin_s) || 0);
      panel.innerHTML = "";
      panel.appendChild(h(htmlPista(e, fila) + `<button class="btn primario" id="siguiente">Siguiente</button>`));
      app.querySelector("#siguiente").addEventListener("click", () => {
        fila.reproducciones_pista = rep.estado.reproduccionesPista; guardar();
        siguienteEstimulo();
      });
      window.scrollTo(0, 0);
    }
  }

  /* ---------- 4. cierre ---------- */
  function pantallaEstrategias() {
    progreso("Cierre");
    pintar(`
      <h1>Verificar más allá de los sentidos</h1>
      <p>Tus ojos y tus oídos dan pistas, pero no certezas. Cuando algo importa, usa también estas estrategias:</p>
      <div class="tarjeta"><h3 style="margin-top:0">🖼️ Con imágenes</h3>
        <ul class="estrategias">
          <li><b>Busca la fuente original</b>¿Quién la publicó primero? ¿Es una cuenta o un medio confiable?</li>
          <li><b>Haz una búsqueda inversa</b>Usa Google Lens, TinEye o Bing para ver si la imagen ya existía o viene de otro contexto.</li>
          <li><b>Contrasta el contexto</b>Revisa la fecha y el lugar, y mira si otros medios lo reportan.</li>
          <li><b>Revisa metadatos o credenciales de contenido</b>Algunas imágenes traen una etiqueta Content Credentials (C2PA) que indica cómo se hicieron.</li>
        </ul></div>
      <div class="tarjeta"><h3 style="margin-top:0">🔊 Con audios</h3>
        <ul class="estrategias">
          <li><b>Confirma por otro canal</b>Cuelga y llama tú al número que ya conoces de esa persona.</li>
          <li><b>Busca si aparece en medios confiables</b>Un audio "filtrado" que nadie serio reporta merece dudas.</li>
          <li><b>Revisa quién lo envió y en qué contexto</b>¿Número desconocido? ¿Hay urgencia o presión?</li>
          <li><b>Acuerda una "palabra clave" familiar</b>Es una frase que solo ustedes conocen, útil contra estafas con voz.</li>
        </ul></div>
      <button class="btn primario" id="seguir">Hacer dos casos de práctica</button>`);
    app.querySelector("#seguir").addEventListener("click", () => { S.casoIdx = 0; avanzar("caso"); });
  }

  function pantallaCaso() {
    const casos = DATOS.cierre || [];
    const c = casos[S.casoIdx];
    if (!c) { avanzar("confianza_fin"); return; }
    progreso(`Cierre · caso ${S.casoIdx + 1} de ${casos.length}`);
    const sel = new Set(); let texto = "";
    pintar(`
      <h2>Caso ${S.casoIdx + 1}</h2>
      <div id="media"></div>
      <div class="pie-viral">${esc(c.contexto)}</div>
      <div class="tarjeta">
        <p><b>${esc(c.pregunta)}</b> <span class="suave">Puedes elegir varias.</span></p>
        ${c.opciones.map(o => `<label class="check"><input type="checkbox" value="${esc(o.id)}"> <span>${esc(o.texto)}</span></label>`).join("")}
        <p><b>¿Por qué?</b> <span class="suave">(opcional)</span></p>
        <input type="text" id="texto" maxlength="140">
      </div>
      <button class="btn primario" id="seguir" disabled>Continuar</button>`);
    const media = app.querySelector("#media");
    if (c.medio === "imagen") {
      media.innerHTML = `<div class="lienzo-img"><div class="marco"><img src="${esc(c.archivo)}" alt="Imagen del caso"></div></div>`;
    } else {
      const rep = Reproductor.crear({ url: c.archivo, max: 0 });
      media.appendChild(rep.el); limpiar.push(rep.destruir);
    }
    const b = app.querySelector("#seguir");
    app.querySelectorAll("input[type=checkbox]").forEach(x => x.addEventListener("change", () => {
      x.checked ? sel.add(x.value) : sel.delete(x.value); b.disabled = sel.size === 0;
    }));
    app.querySelector("#texto").addEventListener("input", ev => { texto = ev.target.value; });
    b.addEventListener("click", () => {
      const elegidas = c.opciones.filter(o => sel.has(o.id));
      S.cierre = S.cierre.filter(x => x.caso_cierre !== c.id);
      S.cierre.push({
        id_registro: Datos.uuid(), codigo: S.codigo, timestamp: ahora(), tipo_registro: "cierre",
        id_estimulo: c.id, medio: c.medio, tipo_correcto: c.tipo, caso_cierre: c.id,
        estrategias: elegidas.map(o => o.id).join("|"),
        estrategia_no_sensorial: elegidas.some(o => !o.sensorial) ? 1 : 0,
        texto: texto.trim().slice(0, 140), version_estimulos: DATOS.version || ""
      });
      S.casoIdx++; guardar(); pantallaCaso();
    });
  }

  /* ---------- 5. completar y guardar ---------- */
  function completar() {
    const v = DATOS.version || "";
    const filas = [
      { id_registro: Datos.uuid(), codigo: S.codigo, timestamp: S.inicio, tipo_registro: "confianza_inicial",
        confianza_imagen: S.confIni.imagen, confianza_audio: S.confIni.audio, version_estimulos: v },
      ...S.respuestas,
      ...S.cierre,
      { id_registro: Datos.uuid(), codigo: S.codigo, timestamp: ahora(), tipo_registro: "confianza_final",
        confianza_imagen: S.confFin.imagen, confianza_audio: S.confFin.audio, texto: (S.reflexion || "").trim().slice(0, 280), version_estimulos: v },
      { id_registro: Datos.uuid(), codigo: S.codigo, timestamp: ahora(), tipo_registro: "sesion",
        tiempo_respuesta_s: Math.round((S.finMs - S.inicioMs) / 1000), version_estimulos: v }
    ];
    S.completado = true;
    Datos.guardarSesion(filas);
  }

  /* ---------- 6. revelación ---------- */
  function pantallaRevelacion() {
    progreso("Revelación");
    const R = S.respuestas;
    const cuenta = (ronda, medio) => {
      const f = R.filter(x => x.ronda === ronda && (!medio || x.medio === medio));
      return { a: f.filter(x => Number(x.acierto) === 1).length, n: f.length };
    };
    const celda = o => `${o.a}/${o.n}`;
    const reales = R.filter(x => x.tipo_correcto === "real");
    const realesComoIA = reales.filter(x => x.decision === "ia").length;
    const todos = [...SECUENCIA, ...(DATOS.cierre || [])];
    const flecha = (a, b) => b > a ? "↑" : b < a ? "↓" : "=";

    pintar(`
      <h1>Revelación final</h1>
      <div class="tarjeta resumen">
        <h3 style="margin-top:0">Tu resumen</h3>
        <table>
          <tr><th></th><th>Ronda 1</th><th>Ronda 2</th></tr>
          <tr><td>Imágenes</td><td>${celda(cuenta(1, "imagen"))}</td><td>${celda(cuenta(2, "imagen"))}</td></tr>
          <tr><td>Audios</td><td>${celda(cuenta(1, "audio"))}</td><td>${celda(cuenta(2, "audio"))}</td></tr>
          <tr><td><b>Total</b></td><td><b>${celda(cuenta(1))}</b></td><td><b>${celda(cuenta(2))}</b></td></tr>
        </table>
        <table style="margin-top:12px">
          <tr><th>Confianza</th><th>Inicial</th><th>Final</th></tr>
          <tr><td>Imágenes</td><td>${S.confIni.imagen}/5</td><td>${S.confFin.imagen}/5 ${flecha(S.confIni.imagen, S.confFin.imagen)}</td></tr>
          <tr><td>Audios</td><td>${S.confIni.audio}/5</td><td>${S.confFin.audio}/5 ${flecha(S.confIni.audio, S.confFin.audio)}</td></tr>
        </table>
        <p>De los ${reales.length} contenidos <b>reales</b>, marcaste ${realesComoIA} como generados con IA.</p>
        <p class="aviso">Ni todo es falso ni basta con los sentidos. La mayoría de lo que vemos y oímos es real. Cuando algo importa (una noticia, una petición de dinero), <b>verifica la fuente y el contexto</b> en vez de confiar solo en tu ojo o tu oído.</p>
      </div>
      <h2>Todo lo que viste y escuchaste</h2>
      <p class="aviso"><b>No compartas estos archivos fuera de esta experiencia.</b> El contenido sintético se creó solo con fines educativos.</p>
      <div class="galeria">
        ${todos.map(e => {
          const ia = e.tipo === "ia";
          const tit = e.ronda ? `Ronda ${e.ronda} · ${e.id}` : `Cierre · ${e.id}`;
          const med = e.medio === "imagen"
            ? `<div class="med"><img src="${esc(e.archivo)}" alt="${esc(e.id)}" loading="lazy">${ia ? `<div class="marca-agua"><span>SINTÉTICO, generado con IA para fines educativos</span></div>` : ""}</div>`
            : `<div class="med audio-med">🔊<audio controls preload="none" playsinline src="${esc(e.archivo)}"></audio></div>${ia ? `<div class="etiqueta-audio">SINTÉTICO, generado con IA para fines educativos</div>` : ""}`;
          const mia = R.find(x => x.id_estimulo === e.id);
          return `<div class="item">${med}<div class="txt">
            <span class="etq ${e.tipo}">${ia ? "IA" : "Real"}</span> ${esc(tit)}
            ${mia ? `<div class="suave">Tu respuesta: ${mia.decision === "ia" ? "IA" : "Real"} ${Number(mia.acierto) ? "✓" : "✗"}</div>` : ""}
          </div></div>`;
        }).join("")}
      </div>
      <button class="btn primario" id="terminar">Terminar</button>
      <p class="estado-envio" id="estado-envio"></p>`);
    const est = app.querySelector("#estado-envio");
    const pintarEstado = s => {
      if (!est.isConnected) return;
      est.textContent = s.modo === "local" ? "Respuestas guardadas en este dispositivo."
        : s.pendientes ? `Guardado en el dispositivo. Enviando… (${s.pendientes} pendientes, se reintenta solo)` : "Respuestas guardadas y enviadas ✓";
    };
    Datos.alCambiarEnvio(pintarEstado); pintarEstado(Datos.estadoEnvio());
    app.querySelector("#terminar").addEventListener("click", () => {
      S.terminado = true; Datos.borrarSesion();
      const cod = S.codigo; S = null; barraCodigo(); progreso("");
      pintar(`<div class="tarjeta"><h1>¡Gracias por participar!</h1>
        <p>Tu código fue <b>${esc(cod)}</b>. Ya puedes devolver la atención a la persona que facilita.</p>
        <p class="suave">Si usas un dispositivo compartido, la siguiente persona puede empezar desde aquí.</p>
        <button class="btn" id="nueva">Nueva participación</button></div>`);
      app.querySelector("#nueva").addEventListener("click", pantallaConsentimiento);
    });
  }

  cargar();
})();
