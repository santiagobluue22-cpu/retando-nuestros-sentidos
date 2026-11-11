/* Panel del equipo: indicadores de evaluación, mapas de calor, histogramas y exportación CSV. */
(function () {
  const CFG = window.CONFIG || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MEDIOS = [["imagen", "Imagen"], ["audio", "Audio"], ["total", "Total"]];
  let EST = null;              // estimulos.json
  let FILAS = new Map();       // id_registro -> fila
  let soloCompletas = true;

  /* ---------- acceso ---------- */
  function entrar() {
    const v = $("#clave").value;
    if (v && v === CFG.CLAVE_PANEL) {
      try { sessionStorage.setItem("rns_panel", v); } catch (e) {}
      $("#acceso").classList.add("oculto"); $("#contenido").classList.remove("oculto"); iniciar(v);
    } else $("#err").classList.remove("oculto");
  }
  $("#entrar").addEventListener("click", entrar);
  $("#clave").addEventListener("keydown", e => { if (e.key === "Enter") entrar(); });
  try { const g = sessionStorage.getItem("rns_panel"); if (g && g === CFG.CLAVE_PANEL) { $("#clave").value = g; entrar(); } } catch (e) {}

  /* ---------- datos ---------- */
  function agregar(filas, origen) {
    let n = 0;
    filas.forEach(f => {
      const o = Datos.normalizar(f);
      if (!o.id_registro) o.id_registro = [o.codigo, o.tipo_registro, o.id_estimulo, o.caso_cierre, o.timestamp].join("|");
      if (!FILAS.has(o.id_registro)) { FILAS.set(o.id_registro, o); n++; }
    });
    $("#estado").textContent = `${FILAS.size} filas cargadas`;
    aviso(`${origen}: ${filas.length} filas leídas, ${n} nuevas.`);
    render();
  }
  function aviso(t, error) { const a = $("#msg"); if (a) { a.textContent = t; a.className = "aviso" + (error ? " error" : ""); } }

  async function desdeSheets(clave) {
    if (!CFG.ENDPOINT_SHEETS) { aviso("No hay ENDPOINT_SHEETS en config.js.", true); return; }
    aviso("Leyendo Google Sheets…");
    try {
      const r = await fetch(CFG.ENDPOINT_SHEETS + "?accion=leer&clave=" + encodeURIComponent(clave));
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "respuesta no válida");
      agregar(j.filas || [], "Google Sheets");
    } catch (e) { aviso("No se pudo leer Google Sheets: " + e.message + ". Revisa la URL, la clave de lectura del script y que el despliegue sea «Cualquier persona».", true); }
  }

  async function iniciar(clave) {
    try { EST = await (await fetch("estimulos.json", { cache: "no-cache" })).json(); } catch (e) { EST = { estimulos: [], cierre: [] }; }
    $("#contenido").innerHTML = `
      <div class="tarjeta">
        <h2>Fuentes de datos</h2>
        <div class="fuentes">
          <button class="btn primario" id="f-sheets" ${CFG.ENDPOINT_SHEETS ? "" : "disabled"}>Cargar de Google Sheets</button>
          <button class="btn" id="f-local">Cargar de este dispositivo</button>
          <label class="btn" style="cursor:pointer">Importar CSV<input type="file" id="f-csv" accept=".csv,text/csv" multiple hidden></label>
          <button class="btn" id="f-export">⬇ Exportar todo en CSV</button>
        </div>
        <label class="check" style="margin-top:10px"><input type="checkbox" id="solo" checked> <span>Solo sesiones completas (con confianza final)</span></label>
        <p id="msg" class="aviso">Elige una fuente. Las filas repetidas (mismo id_registro) se combinan una sola vez.</p>
      </div>
      <nav class="secciones">
        <a href="#s1">1 · Aciertos</a><a href="#s2">2 · Justificación</a><a href="#s3">3 · Confianza y calibración</a>
        <a href="#s4">4 · Verificación</a><a href="#s5">5 · Mapas e histogramas</a><a href="#s6">6 · Reproducciones</a><a href="#s7">Revisión de estímulos</a>
      </nav>
      <div id="resultados"></div>`;
    $("#f-sheets").addEventListener("click", () => desdeSheets(clave));
    $("#f-local").addEventListener("click", () => agregar(Datos.filasLocales(), "Este dispositivo"));
    $("#f-csv").addEventListener("change", ev => {
      Array.from(ev.target.files).forEach(f => { const r = new FileReader(); r.onload = () => agregar(Datos.desdeCSV(r.result), f.name); r.readAsText(f, "utf-8"); });
      ev.target.value = "";
    });
    $("#f-export").addEventListener("click", () => {
      const filas = Array.from(FILAS.values()).sort((a, b) => (a.codigo + a.timestamp).localeCompare(b.codigo + b.timestamp));
      Datos.descargar(`retando_sentidos_${new Date().toISOString().slice(0, 10)}.csv`, Datos.aCSV(filas));
    });
    $("#solo").addEventListener("change", ev => { soloCompletas = ev.target.checked; render(); });
    if (CFG.ENDPOINT_SHEETS) desdeSheets(clave); else agregar(Datos.filasLocales(), "Este dispositivo");
  }

  /* ---------- cálculos ---------- */
  const num = v => (v === "" || v == null ? null : Number(v));
  const media = a => { const b = a.filter(x => x !== null && !isNaN(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
  const pct = (a, n) => (n ? (100 * a / n) : null);
  const f1 = v => (v === null || v === undefined || isNaN(v) ? "—" : (Math.round(v * 10) / 10).toString());
  const fp = v => (v === null || v === undefined || isNaN(v) ? "—" : Math.round(v) + "%");
  const confAPct = c => (c === null ? null : 50 + (c - 1) * 12.5); // 1 = adivinar (50%), 5 = certeza (100%)

  function conjunto() {
    let filas = Array.from(FILAS.values());
    if (soloCompletas) {
      const ok = new Set(filas.filter(f => f.tipo_registro === "confianza_final").map(f => f.codigo));
      filas = filas.filter(f => ok.has(f.codigo));
    }
    const est = filas.filter(f => f.tipo_registro === "estimulo");
    const codigos = Array.from(new Set(filas.map(f => f.codigo))).sort();
    return { filas, est, codigos };
  }
  const deMedio = (arr, m) => (m === "total" ? arr : arr.filter(f => f.medio === m));
  const deRonda = (arr, r) => arr.filter(f => Number(f.ronda) === r);
  const tasa = (arr, campo) => pct(arr.filter(f => Number(f[campo]) === 1).length, arr.length);

  /* ---------- componentes ---------- */
  function leyenda(a, b) {
    return `<div class="leyenda-s"><span><i style="background:var(--s1)"></i>${a}</span><span><i style="background:var(--s2)"></i>${b}</span></div>`;
  }
  // grupos: [{titulo, barras:[{serie, color, valor(0-100), texto, tip}]}]
  function barras(grupos, max) {
    max = max || 100;
    return grupos.map(g => `<div class="grupo"><div class="t">${g.titulo}</div>
      ${g.barras.map(b => `<div class="barra-h" data-tip="${esc(b.tip || "")}">
        <span class="ser">${b.serie}</span>
        <span class="pista"><span class="relleno" style="display:block;width:${b.valor === null ? 0 : Math.max(0.5, b.valor / max * 100)}%;background:${b.color}"></span></span>
        <span class="val">${b.texto}</span></div>`).join("")}</div>`).join("");
  }
  function tabla(cab, filas) {
    return `<div class="scroll"><table class="datos"><tr>${cab.map(c => `<th>${c}</th>`).join("")}</tr>
      ${filas.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
  }

  /* ---------- render ---------- */
  function render() {
    const R = $("#resultados"); if (!R || !EST) return;
    const { filas, est, codigos } = conjunto();
    if (!est.length) { R.innerHTML = `<div class="tarjeta"><p>Aún no hay respuestas para mostrar.</p></div>` + seccionRevision(); conectarRevision(); return; }

    const ini = filas.filter(f => f.tipo_registro === "confianza_inicial");
    const fin = filas.filter(f => f.tipo_registro === "confianza_final");
    const cie = filas.filter(f => f.tipo_registro === "cierre");
    const ses = filas.filter(f => f.tipo_registro === "sesion");
    const dur = media(ses.map(f => num(f.tiempo_respuesta_s)));

    let html = `<div class="kpis">
      <div class="kpi"><div class="v">${codigos.length}</div><div class="l">participantes</div></div>
      <div class="kpi"><div class="v">${est.length}</div><div class="l">respuestas a estímulos</div></div>
      <div class="kpi"><div class="v">${fp(tasa(deRonda(est, 1), "acierto"))} → ${fp(tasa(deRonda(est, 2), "acierto"))}</div><div class="l">aciertos R1 → R2 (total)</div></div>
      <div class="kpi"><div class="v">${dur ? f1(dur / 60) + " min" : "—"}</div><div class="l">duración media de sesión</div></div>
    </div>`;

    /* 1. Aciertos */
    html += `<div class="tarjeta" id="s1"><h2>1 · Aciertos ronda 1 vs ronda 2</h2>
      <p class="suave">La ronda 2 es más difícil a propósito, así que mantener o subir el % ya es una señal positiva. Cada fila muestra aciertos/respuestas.</p>
      ${leyenda("Ronda 1", "Ronda 2")}
      ${barras(MEDIOS.map(([m, t]) => ({
        titulo: t, barras: [1, 2].map(r => {
          const a = deRonda(deMedio(est, m), r), ac = a.filter(f => Number(f.acierto) === 1).length;
          return { serie: "Ronda " + r, color: r === 1 ? "var(--s1)" : "var(--s2)", valor: pct(ac, a.length), texto: `${fp(pct(ac, a.length))} (${ac}/${a.length})`, tip: `${t}, ronda ${r}: ${ac} de ${a.length} aciertos` };
        })
      })))}
      <h3>Reales marcados como IA (riesgo de «nada es real»)</h3>
      ${tabla(["Medio", "R1", "R2"], MEDIOS.map(([m, t]) => [t, ...[1, 2].map(r => {
        const a = deRonda(deMedio(est, m), r).filter(f => f.tipo_correcto === "real"); const n = a.filter(f => f.decision === "ia").length;
        return `${fp(pct(n, a.length))} (${n}/${a.length})`;
      })]))}
      <h3>Por persona</h3>
      ${tabla(["Código", "Img R1", "Img R2", "Aud R1", "Aud R2", "Total R1", "Total R2", "Δ total"], codigos.map(c => {
        const e = est.filter(f => f.codigo === c);
        const v = (m, r) => { const a = deRonda(deMedio(e, m), r); return { p: tasa(a, "acierto"), t: `${a.filter(f => Number(f.acierto) === 1).length}/${a.length}` }; };
        const t1 = v("total", 1), t2 = v("total", 2);
        const d = t1.p !== null && t2.p !== null ? t2.p - t1.p : null;
        return [esc(c), v("imagen", 1).t, v("imagen", 2).t, v("audio", 1).t, v("audio", 2).t, `${t1.t} (${fp(t1.p)})`, `${t2.t} (${fp(t2.p)})`, d === null ? "—" : (d > 0 ? "+" : "") + Math.round(d) + " pp"];
      }))}
    </div>`;

    /* 2. Justificación */
    const catsTodas = Array.from(new Set(est.map(f => f.categoria_detalle))).filter(Boolean).sort();
    html += `<div class="tarjeta" id="s2"><h2>2 · Calidad de la justificación</h2>
      <p class="suave">% de respuestas que señalan un detalle concreto, frente a «fue intuición».</p>
      ${leyenda("Ronda 1", "Ronda 2")}
      ${barras(MEDIOS.map(([m, t]) => ({
        titulo: t + " · detalle concreto", barras: [1, 2].map(r => {
          const a = deRonda(deMedio(est, m), r), c = a.filter(f => Number(f.detalle_concreto) === 1).length;
          return { serie: "Ronda " + r, color: r === 1 ? "var(--s1)" : "var(--s2)", valor: pct(c, a.length), texto: `${fp(pct(c, a.length))} (${c}/${a.length})`, tip: `${t}, R${r}: ${c} concretas, ${a.length - c} «intuición»` };
        })
      })))}
      <h3>Categorías elegidas</h3>
      ${tabla(["Categoría", "Medio", "R1", "R2", "% acierto cuando se usa"], catsTodas.flatMap(cat => ["imagen", "audio"].map(m => {
        const a = est.filter(f => f.categoria_detalle === cat && f.medio === m); if (!a.length) return null;
        return [esc(cat), m, deRonda(a, 1).length, deRonda(a, 2).length, fp(tasa(a, "acierto"))];
      }).filter(Boolean)))}
    </div>`;

    /* 3. Confianza y calibración */
    const ci = m => media(ini.map(f => num(f["confianza_" + m]))), cf = m => media(fin.map(f => num(f["confianza_" + m])));
    html += `<div class="tarjeta" id="s3"><h2>3 · Confianza inicial vs final y calibración</h2>
      ${leyenda("Inicial", "Final")}
      ${barras(["imagen", "audio"].map(m => ({
        titulo: m === "imagen" ? "Imagen (escala 1–5)" : "Audio (escala 1–5)",
        barras: [["Inicial", ci(m), "var(--s1)"], ["Final", cf(m), "var(--s2)"]].map(([s, v, c]) => ({ serie: s, color: c, valor: v, texto: f1(v) + " / 5", tip: `${s}: media ${f1(v)}` }))
      })).concat([{
        titulo: "Total (promedio de ambos medios)",
        barras: [["Inicial", media([ci("imagen"), ci("audio")]), "var(--s1)"], ["Final", media([cf("imagen"), cf("audio")]), "var(--s2)"]].map(([s, v, c]) => ({ serie: s, color: c, valor: v, texto: f1(v) + " / 5" }))
      }]), 5)}
      <h3>Calibración: confianza en cada decisión vs aciertos reales</h3>
      <p class="suave">La confianza 1–5 se traduce a probabilidad esperada (1 = 50 %, que es adivinar; 5 = 100 %). Brecha positiva = sobreconfianza.</p>
      ${tabla(["Medio", "Ronda", "Confianza media", "Esperado", "Aciertos reales", "Brecha"], MEDIOS.flatMap(([m, t]) => [1, 2].map(r => {
        const a = deRonda(deMedio(est, m), r); const c = media(a.map(f => num(f.confianza))); const e = confAPct(c), ac = tasa(a, "acierto");
        return [t, "R" + r, f1(c), fp(e), fp(ac), e === null || ac === null ? "—" : (e - ac > 0 ? "+" : "") + Math.round(e - ac) + " pp"];
      })))}
      <h3>Aciertos por nivel de confianza</h3>
      <p class="suave">Si la gente está bien calibrada, el % de aciertos sube con el nivel de confianza.</p>
      ${tabla(["Confianza", "n", "% aciertos imagen", "% aciertos audio", "% aciertos total"], [1, 2, 3, 4, 5].map(c => {
        const a = est.filter(f => num(f.confianza) === c);
        return [c, a.length, fp(tasa(deMedio(a, "imagen"), "acierto")), fp(tasa(deMedio(a, "audio"), "acierto")), fp(tasa(a, "acierto"))];
      }))}
      <h3>Autoevaluación inicial vs desempeño</h3>
      ${tabla(["Medio", "Confianza inicial", "Esperado", "Aciertos R1+R2", "Confianza final"], ["imagen", "audio"].map(m => [m, f1(ci(m)), fp(confAPct(ci(m))), fp(tasa(deMedio(est, m), "acierto")), f1(cf(m))]))}
    </div>`;

    /* 4. Verificación */
    html += `<div class="tarjeta" id="s4"><h2>4 · Estrategias de verificación en el cierre</h2>
      <p class="suave">% de participantes que eligen al menos una estrategia que NO depende de los sentidos.</p>
      ${barras((EST.cierre || []).map(c => {
        const a = cie.filter(f => f.caso_cierre === c.id), n = a.filter(f => Number(f.estrategia_no_sensorial) === 1).length;
        return { titulo: `${c.id} · ${c.medio === "imagen" ? "imagen viral" : "nota de voz"}`, barras: [{ serie: "Participantes", color: "var(--s1)", valor: pct(n, a.length), texto: `${fp(pct(n, a.length))} (${n}/${a.length})` }] };
      }))}
      ${(EST.cierre || []).map(c => {
        const a = cie.filter(f => f.caso_cierre === c.id);
        return `<h3>${esc(c.id)}: opciones elegidas</h3>` + tabla(["Opción", "¿Sensorial?", "Personas", "%"], c.opciones.map(o => {
          const n = a.filter(f => String(f.estrategias).split("|").includes(o.id)).length;
          return [esc(o.texto), o.sensorial ? "sí" : "no", n, fp(pct(n, a.length))];
        }));
      }).join("")}
      <h3>Reflexiones finales</h3>
      <ul>${fin.filter(f => f.texto).map(f => `<li><span class="suave">${esc(f.codigo)}:</span> ${esc(f.texto)}</li>`).join("") || "<li class='suave'>Sin textos.</li>"}</ul>
    </div>`;

    /* 5. Mapas / histogramas */
    const imgs = EST.estimulos.filter(e => e.medio === "imagen"), auds = EST.estimulos.filter(e => e.medio === "audio");
    html += `<div class="tarjeta" id="s5"><h2>5 · Dónde miran y qué momento marcan</h2>
      <p class="suave">Imágenes: cada toque suma calor (naranja); el círculo punteado blanco es la zona clave. Audios: segundos marcados agrupados de 1 en 1; las barras naranjas caen dentro del fragmento clave.</p>
      <h3>Imágenes</h3><div class="rejilla">${imgs.map(e => {
        const a = est.filter(f => f.id_estimulo === e.id);
        return `<div><div class="mapa" data-mapa="${esc(e.id)}"><img src="${esc(e.archivo)}" alt="${esc(e.id)}"><canvas></canvas></div>
          <p class="suave">${esc(e.id)} · ${e.tipo === "ia" ? "IA" : "Real"} · ${a.length} marcas · ${fp(tasa(a, "acierto"))} aciertos</p></div>`;
      }).join("")}</div>
      <h3>Audios</h3><div class="rejilla">${auds.map(e => `<div data-hist="${esc(e.id)}"></div>`).join("")}</div>
    </div>`;

    /* 6. Reproducciones */
    html += `<div class="tarjeta" id="s6"><h2>6 · Reproducciones promedio por audio</h2>
      ${barras([{
        titulo: `Promedio durante la decisión (máximo ${CFG.MAX_REPRODUCCIONES || 3})`, barras: auds.map(e => {
          const a = est.filter(f => f.id_estimulo === e.id), v = media(a.map(f => num(f.reproducciones)));
          return { serie: e.id, color: Number(e.ronda) === 1 ? "var(--s1)" : "var(--s2)", valor: v, texto: f1(v) + ` (n=${a.length})`, tip: `${e.id}: ${f1(v)} reproducciones en promedio; fragmento en la pista: ${f1(media(a.map(f => num(f.reproducciones_pista))))}` };
        })
      }], CFG.MAX_REPRODUCCIONES || 3)}
      ${leyenda("Audio de ronda 1", "Audio de ronda 2")}
      ${tabla(["Audio", "Ronda", "Tipo", "Reprod. media", "Fragmento en pista (media)", "% aciertos"], auds.map(e => {
        const a = est.filter(f => f.id_estimulo === e.id);
        return [esc(e.id), e.ronda, e.tipo, f1(media(a.map(f => num(f.reproducciones)))), f1(media(a.map(f => num(f.reproducciones_pista)))), fp(tasa(a, "acierto"))];
      }))}
    </div>`;

    html += seccionRevision();
    R.innerHTML = html;
    dibujarMapas(est); dibujarHistogramas(est); conectarRevision();
  }

  function dibujarMapas(est) {
    document.querySelectorAll("[data-mapa]").forEach(div => {
      const id = div.dataset.mapa, e = EST.estimulos.find(x => x.id === id);
      const img = div.querySelector("img"), cv = div.querySelector("canvas");
      const pts = est.filter(f => f.id_estimulo === id && f.coord_x_pct !== "").map(f => [num(f.coord_x_pct), num(f.coord_y_pct)]);
      const pintar = () => {
        const w = img.clientWidth, h = img.clientHeight, dpr = window.devicePixelRatio || 1;
        cv.width = w * dpr; cv.height = h * dpr;
        const g = cv.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
        const rad = Math.max(18, w * 0.09);
        g.globalCompositeOperation = "lighter";
        pts.forEach(([x, y]) => {
          const cx = x / 100 * w, cy = y / 100 * h;
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
          gr.addColorStop(0, "rgba(235,104,52,0.55)"); gr.addColorStop(1, "rgba(235,104,52,0)");
          g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        });
        g.globalCompositeOperation = "source-over";
        pts.forEach(([x, y]) => { g.beginPath(); g.arc(x / 100 * w, y / 100 * h, 3, 0, 7); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 1; g.strokeStyle = "#000"; g.stroke(); });
        const z = e.zona_clave || {};
        if (z.x !== undefined) {
          g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeStyle = "#fff";
          g.beginPath(); g.arc(z.x / 100 * w, z.y / 100 * h, (z.radio || 10) / 100 * w, 0, 7); g.stroke(); g.setLineDash([]);
        }
      };
      const dentro = pts.filter(([x, y]) => { const z = e.zona_clave || {}; const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1; const dx = (x - z.x), dy = (y - z.y) * ih / iw; return Math.hypot(dx, dy) <= (z.radio || 10); }).length;
      div.dataset.tip = `${id}: ${pts.length} marcas, ${dentro} dentro de la zona clave`;
      img.complete ? pintar() : img.addEventListener("load", pintar);
      window.addEventListener("resize", pintar);
    });
  }

  function dibujarHistogramas(est) {
    document.querySelectorAll("[data-hist]").forEach(div => {
      const id = div.dataset.hist, e = EST.estimulos.find(x => x.id === id), z = e.zona_clave || {};
      const segs = est.filter(f => f.id_estimulo === id && f.segundo_marcado !== "").map(f => num(f.segundo_marcado));
      const pintar = dur => {
        dur = Math.ceil(Math.max(dur || 0, ...segs, Number(z.fin_s) || 0, 1));
        const bins = Array.from({ length: dur }, () => 0);
        segs.forEach(s => { bins[Math.min(dur - 1, Math.floor(s))]++; });
        const mx = Math.max(1, ...bins);
        const enClave = segs.filter(s => s >= z.inicio_s && s <= z.fin_s).length;
        div.innerHTML = `<p style="margin:0 0 4px"><b>${esc(id)}</b> <span class="suave">· ${e.tipo === "ia" ? "IA" : "Real"} · ${segs.length} marcas · ${enClave} en el fragmento clave</span></p>
          <div class="hist">${bins.map((b, i) => `<div class="b ${i + 1 > z.inicio_s && i < z.fin_s ? "clave" : ""}" style="height:${b / mx * 100}%" data-tip="${i}–${i + 1} s: ${b} marca(s)"></div>`).join("")}</div>
          <div class="hist-ejes"><span>0 s</span><span>${dur} s</span></div>`;
      };
      const a = new Audio(); a.preload = "metadata";
      a.addEventListener("loadedmetadata", () => pintar(a.duration));
      a.addEventListener("error", () => pintar(0));
      a.src = e.archivo; pintar(0);
    });
  }

  /* Revisión manual de estímulos: zona clave + pista (para que el equipo revise lo que preparó con IA). */
  function seccionRevision() {
    return `<div class="tarjeta previa" id="s7"><h2>Revisión de estímulos (uso interno)</h2>
      <p class="suave">Aquí el equipo revisa a mano cada pista y comprueba que la zona clave cae en el lugar correcto antes de la sesión.</p>
      <div class="rejilla">${[...EST.estimulos].sort((a, b) => a.ronda - b.ronda || a.orden - b.orden).map(e => `
        <div class="item"><div class="txt">
          <b>${esc(e.id)}</b> · R${e.ronda} · orden ${e.orden} · <span class="etq ${e.tipo}">${e.tipo === "ia" ? "IA" : "Real"}</span> · ${esc(e.dificultad)}
          ${e.medio === "imagen"
            ? `<div class="lienzo-img" style="margin-top:6px"><div class="marco"><img src="${esc(e.archivo)}" alt=""><div class="zona" data-zona='${JSON.stringify(e.zona_clave)}' style="left:${e.zona_clave.x}%;top:${e.zona_clave.y}%"></div></div></div>`
            : `<div style="margin-top:6px"><audio controls preload="none" src="${esc(e.archivo)}" style="width:100%"></audio><div class="suave">Fragmento clave: ${e.zona_clave.inicio_s}–${e.zona_clave.fin_s} s</div></div>`}
          <p class="suave">${esc(e.herramienta_generadora || "—")}<br>${esc(e.prompt_o_guion_usado)}</p>
          <div class="pista-texto">${esc(e.explicacion_pista)}</div>
        </div></div>`).join("")}</div></div>`;
  }
  function conectarRevision() {
    document.querySelectorAll(".previa .zona").forEach(z => {
      const img = z.parentElement.querySelector("img"), d = JSON.parse(z.dataset.zona);
      const t = () => { const s = (d.radio || 10) * 2 / 100 * img.clientWidth; z.style.width = s + "px"; z.style.height = s + "px"; };
      img.complete ? t() : img.addEventListener("load", t);
    });
  }

  /* Tooltip para barras, celdas y mapas (ratón o toque). */
  const tip = $("#tip");
  function mostrarTip(ev) {
    const t = ev.target.closest && ev.target.closest("[data-tip]");
    if (!t || !t.dataset.tip) { tip.style.display = "none"; return; }
    tip.textContent = t.dataset.tip; tip.style.display = "block";
    const x = Math.min(window.innerWidth - 250, ev.clientX + 12), y = ev.clientY + 14;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = y + "px";
  }
  document.addEventListener("mousemove", mostrarTip);
  document.addEventListener("click", mostrarTip);
})();
