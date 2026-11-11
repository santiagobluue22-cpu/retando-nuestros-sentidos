/* Reproductor de audio con forma de onda (Web Audio + canvas), sin dependencias externas.
   - Reproducción con <audio> (compatible con Safari iOS y Chrome Android; requiere gesto del usuario).
   - Forma de onda: se decodifica el MP3 con Web Audio; si falla, se dibuja una onda neutra.
   - Límite de reproducciones, marcado de un segundo, resaltado y reproducción de un fragmento. */
(function () {
  let ctxAudio = null;
  function contexto() {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!ctxAudio) ctxAudio = new C();
    return ctxAudio;
  }
  function decodificar(ab) {
    const c = contexto(); if (!c) return Promise.reject(new Error("sin WebAudio"));
    return new Promise((ok, err) => {
      // Safari antiguo solo acepta la forma con callbacks
      const p = c.decodeAudioData(ab, ok, err);
      if (p && p.then) p.then(ok, err);
    });
  }
  const cachePicos = {};
  async function picos(url, n) {
    const k = url + "|" + n;
    if (cachePicos[k]) return cachePicos[k];
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = await decodificar(await r.arrayBuffer());
    const d = buf.getChannelData(0), paso = Math.floor(d.length / n) || 1, out = [];
    let max = 0;
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * paso; j < Math.min(d.length, (i + 1) * paso); j += 4) { const v = Math.abs(d[j]); if (v > m) m = v; }
      out.push(m); if (m > max) max = m;
    }
    const res = { picos: out.map(v => max ? v / max : 0), duracion: buf.duration };
    cachePicos[k] = res; return res;
  }

  /* Desbloquea audio en iOS: llamar dentro de un gesto del usuario. */
  function desbloquear() {
    const c = contexto();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  }

  function fmt(s) { s = Math.max(0, s || 0); return s.toFixed(1) + " s"; }

  /**
   * opciones: { url, max (reproducciones, 0 = sin límite), alCambiar(estado) }
   * Devuelve un objeto con: el (nodo), reproducciones, duracion, activarMarcado(cb), marcar(seg),
   * mostrarFragmento(ini, fin), reproducirFragmento(), detener(), destruir()
   */
  function crear(op) {
    const el = document.createElement("div");
    el.className = "reproductor";
    el.innerHTML = `
      <div class="onda" aria-label="Forma de onda del audio"><canvas></canvas><div class="cabezal oculto"></div></div>
      <div class="ctrl">
        <button type="button" class="play">▶ Reproducir</button>
        <span class="info"></span>
        <span class="tiempo">0.0 s</span>
      </div>
      <p class="info err oculto" style="color:#ffb4a6"></p>`;
    const onda = el.querySelector(".onda"), canvas = el.querySelector("canvas"),
      cabezal = el.querySelector(".cabezal"), btn = el.querySelector(".play"),
      info = el.querySelector(".ctrl .info"), tiempo = el.querySelector(".tiempo"), err = el.querySelector(".err");

    const audio = new Audio();
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");
    audio.src = op.url;

    const st = {
      reproducciones: 0, reproduccionesPista: 0, duracion: 0, picos: null, cargado: false,
      marcado: null, fragmento: null, modoFragmento: false, finFragmento: null, alMarcar: null, raf: 0
    };
    const max = op.max || 0;

    function actualizarInfo() {
      if (max) info.textContent = `Reproducciones: ${st.reproducciones}/${max}`;
      if (!st.modoFragmento) btn.disabled = !!(max && st.reproducciones >= max && audio.paused); // no se espera 'cargado': iOS no precarga hasta el primer toque
      if (op.alCambiar) op.alCambiar(st);
    }

    function dibujar() {
      const dpr = window.devicePixelRatio || 1;
      const w = onda.clientWidth || 300, h = onda.clientHeight || 110;
      canvas.width = w * dpr; canvas.height = h * dpr;
      const g = canvas.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
      const barras = Math.max(40, Math.floor(w / 4));
      const p = st.picos || Array.from({ length: barras }, (_, i) => 0.25 + 0.15 * Math.sin(i / 3));
      const prog = st.duracion ? audio.currentTime / st.duracion : 0;
      for (let i = 0; i < barras; i++) {
        const v = p[Math.floor(i * p.length / barras)] || 0;
        const bh = Math.max(2, v * (h - 16));
        const x = i * (w / barras);
        g.fillStyle = (i / barras) < prog ? "#6fb3e6" : "#4a6178";
        g.fillRect(x, (h - bh) / 2, Math.max(1, w / barras - 1.5), bh);
      }
    }

    function posicionar(nodo, seg) { nodo.style.left = (st.duracion ? (seg / st.duracion) * 100 : 0) + "%"; }

    function bucle() {
      tiempo.textContent = fmt(audio.currentTime) + " / " + fmt(st.duracion);
      cabezal.classList.remove("oculto"); posicionar(cabezal, audio.currentTime);
      if (st.finFragmento !== null && audio.currentTime >= st.finFragmento) { audio.pause(); }
      dibujar();
      if (!audio.paused) st.raf = requestAnimationFrame(bucle);
    }

    audio.addEventListener("loadedmetadata", () => {
      if (!st.duracion && isFinite(audio.duration)) st.duracion = audio.duration;
      st.cargado = true; tiempo.textContent = "0.0 / " + fmt(st.duracion);
      redibujarCapas(); actualizarInfo();
    });
    audio.addEventListener("canplaythrough", () => { st.cargado = true; actualizarInfo(); });
    audio.addEventListener("error", () => {
      err.textContent = "No se pudo cargar el audio. Avísale a la persona que facilita.";
      err.classList.remove("oculto");
    });
    audio.addEventListener("play", () => { cancelAnimationFrame(st.raf); bucle(); });
    audio.addEventListener("pause", () => {
      st.finFragmento = null; cancelAnimationFrame(st.raf); dibujar();
      btn.textContent = st.modoFragmento ? "▶ Escuchar el fragmento clave" : "▶ Reproducir"; actualizarInfo();
    });
    audio.addEventListener("ended", () => { audio.dispatchEvent(new Event("pause")); });

    btn.addEventListener("click", () => {
      desbloquear();
      if (!audio.paused) { audio.pause(); return; }
      if (st.modoFragmento) { reproducirFragmento(); return; }
      if (max && st.reproducciones >= max) return;
      st.reproducciones++;
      audio.currentTime = 0;
      st.finFragmento = null;
      const p = audio.play();
      if (p && p.catch) p.catch(e => { if (e.name === "AbortError") return; /* detenido por el usuario: sí cuenta */ st.reproducciones--; err.textContent = "Toca otra vez para reproducir (" + e.name + ")."; err.classList.remove("oculto"); actualizarInfo(); });
      btn.textContent = "■ Detener";
      actualizarInfo();
    });

    // Marcado: tocar la onda fija el segundo (no mueve la reproducción).
    onda.addEventListener("click", ev => {
      if (!st.alMarcar || !st.duracion) return;
      const r = onda.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      marcar(Math.round(x * st.duracion * 10) / 10);
      st.alMarcar(st.marcado);
    });

    function capa(clase) {
      let n = onda.querySelector("." + clase.split(" ")[0]);
      if (!n) { n = document.createElement("div"); n.className = clase; onda.appendChild(n); }
      return n;
    }
    function redibujarCapas() {
      if (st.marcado !== null) {
        const l = capa("linea"); posicionar(l, st.marcado);
        l.classList.toggle("der", st.duracion && st.marcado / st.duracion > 0.7);
        l.innerHTML = `<span>${op.etiquetaMarca || "Tu marca"}: ${st.marcado.toFixed(1)} s</span>`;
      }
      if (st.fragmento) {
        const f = capa("fragmento"), d = st.duracion || 1;
        const ini = Math.min(st.fragmento[0], d), fin = Math.min(st.fragmento[1], d);
        f.style.left = (ini / d * 100) + "%"; f.style.width = (Math.max(0.5, fin - ini) / d * 100) + "%";
      }
      dibujar();
    }
    function marcar(seg) { st.marcado = seg; redibujarCapas(); }
    function activarMarcado(cb) { st.alMarcar = cb; onda.classList.add("marcable"); }
    function desactivarMarcado() { st.alMarcar = null; onda.classList.remove("marcable"); }
    function mostrarFragmento(ini, fin) {
      st.fragmento = [ini, fin]; st.modoFragmento = true;
      btn.textContent = "▶ Escuchar el fragmento clave"; btn.disabled = false; info.textContent = "";
      redibujarCapas();
    }
    function reproducirFragmento() {
      if (!st.fragmento) return;
      desbloquear();
      st.reproduccionesPista++;
      const ini = Math.min(st.fragmento[0], Math.max(0, (st.duracion || 1) - 0.5));
      audio.currentTime = ini;
      const p = audio.play();
      st.finFragmento = st.fragmento[1];
      if (p && p.catch) p.catch(() => {});
      btn.textContent = "■ Detener";
    }
    function detener() { try { audio.pause(); } catch (e) {} }
    function destruir() { detener(); cancelAnimationFrame(st.raf); window.removeEventListener("resize", dibujar); audio.removeAttribute("src"); audio.load(); }

    window.addEventListener("resize", dibujar);
    requestAnimationFrame(dibujar);
    picos(op.url, 400).then(r => {
      st.picos = r.picos; if (!st.duracion) st.duracion = r.duracion; redibujarCapas();
    }).catch(() => { /* se queda con onda neutra; el audio igual se reproduce */ });

    actualizarInfo();
    return {
      el, audio, estado: st, marcar, activarMarcado, desactivarMarcado, mostrarFragmento, reproducirFragmento, detener, destruir,
      get reproducciones() { return st.reproducciones; },
      get duracion() { return st.duracion; }
    };
  }

  window.Reproductor = { crear, desbloquear };
})();
