// Dibuja la invitación a partir de la configuración guardada.
import { rpc } from "./api.js";
import { esc, pad, parseFecha, fmtFechaLarga, fmtFechaCorta, fmtHora, urlSegura, resolverFoto, PALETAS, ICONOS, COLORES_VEST } from "./util.js";

const IC_CHECK = `<svg viewBox="0 0 24 24"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>`;
const IC_SOBRE = `<svg class="ico" viewBox="0 0 24 24"><rect x="2.500" y="5" width="19" height="14" rx="1.500" fill="#222"/><path d="M3 6l9 7 9-7" stroke="#fff"/></svg>`;
const IC_CAL = `<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="4.500" width="18" height="16" rx="2" fill="#222"/><path d="M3 9h18M8 2.500v4M16 2.500v4" stroke="#222"/><path stroke="#fff" d="M7 12h2M11 12h2M15 12h2M7 15h2M11 15h2M15 15h2M7 18h2M11 18h2"/></svg>`;
const IC_NOTA = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.600A4 4 0 1 0 14 17V7h4V3z"/></svg>`;
const IC_SOBRE_ABRIR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>`;

// anim: la foto aparece con zoom al llegar a ella al hacer scroll
const foto = (src, label, extra = "", anim = false) => {
  const u = resolverFoto(src);
  return `<figure class="foto ${u ? "tiene" : ""} ${anim ? "rev" : ""}" ${anim ? 'data-a="zoom"' : ""} ${extra}>${u ? `<img src="${esc(u)}" alt="${esc(label)}" loading="lazy">` : ""}</figure>`;
};

function calendario(f) {
  const primero = new Date(f.Y, f.M - 1, 1).getDay();
  const dias = new Date(f.Y, f.M, 0).getDate();
  let h = ["D", "L", "M", "M", "J", "V", "S"].map(x => `<div class="h">${x}</div>`).join("");
  for (let i = 0; i < primero; i++) h += `<div></div>`;
  for (let d = 1; d <= dias; d++) {
    h += d === f.D
      ? `<div class="d hoy">${d}<svg viewBox="0 0 40 40"><path d="M20 35S5 25 5 14.500C5 9 9 6 13 6c3 0 5.500 1.700 7 4.200C21.500 7.700 24 6 27 6c4 0 8 3 8 8.500C35 25 20 35 20 35z"/></svg></div>`
      : `<div class="d">${d}</div>`;
  }
  return h;
}

function lugarHTML(titulo, l, invertir) {
  const mapa = urlSegura(l.mapa);
  const hora = fmtHora(l.hora);
  return `<div class="lugar rev ${invertir ? "rev-dir" : ""} ${l.foto ? "" : "sin-foto"}" data-a="${invertir ? "right" : "left"}">
    ${l.foto ? foto(l.foto, titulo) : ""}
    <div class="info"><h3>${esc(titulo)}</h3>${esc(l.nombre)}${l.dir ? `<br>${esc(l.dir)}` : ""}${hora ? `<b>Hora: ${hora}</b>` : ""}
    ${mapa ? `<a class="btn" href="${esc(mapa)}" target="_blank" rel="noopener">Ver ubicación</a>` : ""}</div>
  </div>`;
}

function textoColores(cols) {
  const nombres = cols.map(c => (COLORES_VEST.find(x => x.c === c) || {}).n).filter(Boolean).map(n => n.toLowerCase());
  if (!nombres.length) return "";
  const lista = nombres.length > 1 ? nombres.slice(0, -1).join(", ") + " y " + nombres.slice(-1) : nombres[0];
  return `Agradecemos evitar la siguiente gama de colores: ${lista}`;
}

// Pétalos que caen suavemente
function petalos(n = 16) {
  const r = Math.random;
  return `<div class="petalos" aria-hidden="true">${Array.from({ length: n }, () =>
    `<i style="left:${(r() * 100).toFixed(1)}%;--dx:${((r() - 0.5) * 180).toFixed(0)}px;--s:${(0.6 + r() * 0.9).toFixed(2)};animation-duration:${(9 + r() * 8).toFixed(1)}s;animation-delay:${(-r() * 14).toFixed(1)}s"></i>`).join("")}</div>`;
}

/* ---------- construcción ---------- */
export function renderInvitacion(root, cfg, guest, opts = {}) {
  const f = parseFecha(cfg.fecha);
  const fo = cfg.fotos || {};
  const colorMain = (PALETAS[cfg.color] || PALETAS.verde).c;
  const rec = cfg.recepcion.mismo ? null : cfg.recepcion;
  const nota = textoColores(cfg.vestimenta.colores);

  const itin = (cfg.itinerario || []).filter(x => x.t && x.t.trim()).map((x, i) =>
    `<div class="ev ${i % 2 ? "d" : "i"} rev" data-a="${i % 2 ? "right" : "left"}" style="grid-column:${i % 2 ? 2 : 1};grid-row:${i + 1};transition-delay:${(i * 0.18).toFixed(2)}s">${(ICONOS[x.ic] || ICONOS.estrella).svg}<b>${esc(x.t)}</b>${x.h ? `<span>Hora: ${fmtHora(x.h)}</span>` : ""}</div>`
  ).join("");

  const mensaje = (cfg.mensaje || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const mosaico = (fo.final || []).filter(Boolean);

  root.className = "inv anim";
  root.style.setProperty("--c", colorMain);
  root.style.setProperty("--c-osc", `color-mix(in srgb, ${colorMain} 80%, #000)`);

  root.innerHTML = `
  ${opts.preview ? `<div class="vista-previa">Vista previa: así verá tu invitación quien la reciba. Los botones de confirmación no guardan nada aquí, y la portada de bienvenida (sobre) solo se ve en la invitación real.</div>` : ""}
  <section class="hero">
    ${foto(cfg.portada, "Portada")}
    ${petalos(16)}
    <div class="arriba">Save the date</div>
    <div class="abajo"><h1>¡Nos casamos!</h1>${f ? `<div class="fecha">${pad(f.D)}.${pad(f.M)}.${f.Y}</div>` : ""}<div class="desliza" aria-hidden="true"><i></i></div></div>
  </section>

  ${guest ? `<section class="para rev"><small>Con mucho cariño invitamos a</small><strong>${esc(guest.nombre)}</strong>${guest.pases > 1 ? `<span>Esta invitación es válida para ${guest.pases} personas</span>` : `<span>Esta invitación es personal</span>`}</section>` : ""}

  <section class="versiculo rev">
    ${cfg.versiculo ? `<p>“${esc(cfg.versiculo)}”</p>${cfg.cita ? `<cite>— ${esc(cfg.cita)}</cite>` : ""}` : ""}
    ${cfg.cancion ? `<div class="player" id="player">
      <div class="barra"><i id="prog"></i><b id="bola"></b></div>
      <div class="controles"><button class="play" id="play" aria-label="Reproducir canción"><svg viewBox="0 0 24 24"><path id="ico-play" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4z"/></svg></button><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
      <p class="indic">Dale clic para reproducir<br>nuestra canción</p>
      <audio id="audio" preload="none" loop src="${esc(cfg.cancion)}"></audio>
    </div>` : ""}
  </section>

  ${fo.mensaje ? foto(fo.mensaje, "Foto", `data-roto="1" style="aspect-ratio:4/5;margin-top:30px"`, true) : ""}

  ${mensaje.length ? `<section class="intro rev">${mensaje.map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</section>` : ""}

  ${cfg.novio || cfg.novia ? `<section class="nombres rev"><span>${esc(cfg.novio)}</span><span class="amp">&amp;</span><span>${esc(cfg.novia)}</span></section>` : ""}

  ${f ? `<section class="dia rev">
    <h2 class="titulo">El gran día</h2>
    <div class="sub">${fmtFechaLarga(cfg.fecha)}</div>
    <div class="cal">${calendario(f)}</div>
    <div class="cuenta"><h3>Faltan…</h3><div class="caja">
      <div><strong id="cd-d">0</strong><small>días</small></div><div><strong id="cd-h">0</strong><small>horas</small></div>
      <div><strong id="cd-m">0</strong><small>min</small></div><div><strong id="cd-s">0</strong><small>seg</small></div>
    </div></div>
  </section>` : ""}

  ${fo.calendario ? foto(fo.calendario, "Foto", `style="aspect-ratio:3/4"`, true) : ""}

  ${cfg.ceremonia.nombre || (rec && rec.nombre) ? `<section class="ubic">
    <h2 class="titulo rev">Ubicación</h2>
    ${cfg.ceremonia.nombre ? lugarHTML(cfg.recepcion.mismo ? "Ceremonia y recepción" : "Ceremonia", cfg.ceremonia, false) : ""}
    ${rec && rec.nombre ? lugarHTML("Recepción", rec, true) : ""}
  </section>` : ""}

  <section class="vest rev">
    <h2 class="titulo">Código de vestimenta</h2>
    <div class="tipo">${esc(cfg.vestimenta.tipo)}</div>
    ${nota ? `<p>${esc(nota)}</p>` : ""}${cfg.vestimenta.nota ? `<p>${esc(cfg.vestimenta.nota)}</p>` : ""}
    ${cfg.vestimenta.colores.length ? `<div class="colores">${cfg.vestimenta.colores.map((x, i) => `<i style="background:${esc(x)};--i:${i}"></i>`).join("")}</div>` : ""}
    <svg class="traje" viewBox="0 0 200 200" fill="none" stroke="#111" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 22l-4 38c-1 12 4 20 8 26-12 24-26 54-30 96h104c-4-42-18-72-30-96 4-6 9-14 8-26l-4-38"/>
      <path d="M40 22c3 8 9 12 16 12s13-4 16-12M44 86c8 6 20 6 28 0M30 182c20-8 60-8 82 0M52 90l-8 90M64 90v92M76 90l8 90"/>
      <path d="M130 30h38v140h-38zM130 30c0-8 6-14 19-14s19 6 19 14M149 16v14l-9 14 9 22 9-22-9-14M149 66v104M130 30l19 36 19-36M138 170v18M160 170v18M136 188h12M158 188h12"/>
    </svg>
  </section>

  ${fo.vestimenta ? foto(fo.vestimenta, "Foto", `style="aspect-ratio:4/5"`, true) : ""}

  ${itin ? `<section class="itin"><h2 class="titulo rev">Itinerario</h2><div class="linea rev" data-a="none">${itin}</div></section>` : ""}

  ${fo.itinerario ? foto(fo.itinerario, "Foto", `style="aspect-ratio:3/4"`, true) : ""}

  ${cfg.sobres.activo && cfg.sobres.texto ? `<section class="simple rev">${IC_SOBRE}<h2 class="titulo">Lluvia de sobres</h2><p>${esc(cfg.sobres.texto)}</p></section>` : ""}

  <section class="simple rev" style="padding-top:60px" id="confirmar">
    ${IC_CAL}
    <h2 class="titulo">Confirmación de asistencia</h2>
    ${cfg.confirmarAntes ? `<p>Agradecemos confirmar tu<br>asistencia antes del ${fmtFechaCorta(cfg.confirmarAntes)}</p>` : `<p>Agradecemos confirmar tu asistencia</p>`}
    <div class="estado" id="estado"></div>
  </section>

  <section class="final rev">
    <h2 class="titulo">¡Te esperamos!</h2>
    ${mosaico.length ? `<div class="mosaico">${mosaico.map((s, i) => foto(s, "Foto", `style="transition-delay:${(i * 0.14).toFixed(2)}s"`, true)).join("")}</div>` : ""}
  </section>
  <div class="cierre"></div>
  ${cfg.cancion ? `<button class="fab" id="fab" aria-label="Música">${IC_NOTA}</button>` : ""}`;

  root.querySelectorAll("[data-roto]").forEach(rasgar);
  if (f) cuentaRegresiva(root, f, cfg.ceremonia.hora);
  if (cfg.cancion) musica(root);
  pintarEstado(root, cfg, guest, opts);
  paralaje(root);
  revelar(root);

  // Portada de bienvenida (solo en la invitación real): al abrir empieza la música y las animaciones
  if (opts.preview) { root.classList.add("listo"); return; }
  portadaBienvenida(root, cfg, guest, colorMain);
}

/* ---------- portada de bienvenida ---------- */
function portadaBienvenida(root, cfg, guest, color) {
  const f = parseFecha(cfg.fecha);
  const bg = resolverFoto(cfg.portada);
  const o = document.createElement("div");
  o.className = "inv-intro";
  o.style.setProperty("--c", color);
  if (bg) o.style.backgroundImage = `url("${bg}")`;
  o.innerHTML = `${petalos(18)}<div class="in-card">
    <div class="in-top">Estás invitado a la boda de</div>
    <div class="in-names">${esc(cfg.novio)}<span>&amp;</span>${esc(cfg.novia)}</div>
    <div class="in-line"></div>
    ${f ? `<div class="in-date">${pad(f.D)} · ${pad(f.M)} · ${f.Y}</div>` : ""}
    ${guest ? `<div class="in-for">Invitación para<br><b>${esc(guest.nombre)}</b></div>` : ""}
    <button class="in-open">${IC_SOBRE_ABRIR} Abrir invitación</button>
  </div>`;
  document.body.appendChild(o);
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  $abrir(o.querySelector(".in-open"), () => {
    document.body.style.overflow = prev;
    o.classList.add("abre");
    root.classList.add("listo");
    const a = root.querySelector("#audio");
    if (a) a.play().catch(() => {});
    setTimeout(() => o.remove(), 1300);
  });
}
const $abrir = (btn, fn) => btn.addEventListener("click", fn, { once: true });

/* ---------- confirmación ---------- */
function pintarEstado(root, cfg, guest, opts) {
  const box = root.querySelector("#estado");
  if (!box) return;
  if (!guest) { // vista previa sin invitado concreto
    box.innerHTML = `<button class="btn grande" data-acc="confirmar">Confirmar aquí</button>`;
  } else if (guest.estado === "confirmado") {
    const n = guest.asistentes || guest.pases;
    box.innerHTML = `<span class="ok">${IC_CHECK} Asistencia confirmada${guest.pases > 1 ? ` · ${n} ${n === 1 ? "persona" : "personas"}` : ""}</span><br><button class="link" data-acc="confirmar">Cambiar mi respuesta</button>`;
  } else if (guest.estado === "declinado") {
    box.innerHTML = `<span class="no">Avisaste que no podrás asistir</span><br><button class="link" data-acc="confirmar">Cambiar mi respuesta</button>`;
  } else {
    box.innerHTML = `<button class="btn grande" data-acc="confirmar">Confirmar aquí</button><br><button class="link" data-acc="declinar">No podré asistir</button>`;
  }
  box.querySelectorAll("[data-acc]").forEach(b => b.addEventListener("click", () => {
    abrirModal({ tipo: b.dataset.acc, cfg, guest, opts, onDone: nuevo => { Object.assign(guest || (guest = {}), nuevo); pintarEstado(root, cfg, guest, opts); } });
  }));
}

function abrirModal({ tipo, cfg, guest, opts, onDone }) {
  const conf = tipo === "confirmar";
  const nombre = guest ? guest.nombre : "Nombre del invitado";
  const pases = guest ? guest.pases : 1;
  let n = guest && guest.asistentes ? guest.asistentes : pases;
  const m = document.createElement("div");
  m.className = "inv-modal";
  m.style.setProperty("--c", (PALETAS[cfg.color] || PALETAS.verde).c);
  document.body.appendChild(m);
  const cerrar = () => { m.remove(); document.removeEventListener("keydown", esc_); };
  const esc_ = e => { if (e.key === "Escape") cerrar(); };
  document.addEventListener("keydown", esc_);
  m.addEventListener("click", e => { if (e.target === m) cerrar(); });

  const pregunta = () => {
    m.innerHTML = `<div class="caja" role="dialog" aria-modal="true">
      <div class="ic"><svg viewBox="0 0 24 24">${conf ? `<path d="M5 12.500l4.500 4.500L19 7.500"/>` : `<path d="M6 6l12 12M18 6L6 18"/>`}</svg></div>
      <h2>${conf ? "¿Seguro que deseas confirmar tu asistencia a la boda?" : "¿Seguro que no podrás asistir a la boda?"}</h2>
      <div class="quien">${esc(nombre)}</div>
      ${conf && pases > 1 ? `<div class="cuantos">¿Cuántas personas asistirán?<div class="paso"><button data-d="-1" aria-label="Menos">−</button><b id="n">${n}</b><button data-d="1" aria-label="Más">+</button></div><p>Máximo ${pases}</p></div>` : ""}
      <div class="acciones"><button class="no" id="m-no">No</button><button class="si" id="m-si">${conf ? "Sí, confirmar" : "Sí, no asistiré"}</button></div>
      <div class="err" id="m-err" hidden></div>
    </div>`;
    m.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
      n = Math.max(1, Math.min(pases, n + +b.dataset.d));
      m.querySelector("#n").textContent = n;
    }));
    m.querySelector("#m-no").addEventListener("click", cerrar);
    m.querySelector("#m-si").addEventListener("click", enviar);
  };

  const enviar = async () => {
    const si = m.querySelector("#m-si"), no = m.querySelector("#m-no"), err = m.querySelector("#m-err");
    si.disabled = no.disabled = true; si.textContent = "Guardando…"; err.hidden = true;
    try {
      let res;
      if (opts.preview) res = { estado: conf ? "confirmado" : "declinado", asistentes: conf ? n : null };
      else res = await rpc("boda_invitado_responder", { p_codigo: opts.codigo, p_estado: conf ? "confirmado" : "declinado", p_asistentes: conf ? n : null });
      onDone({ estado: res.estado, asistentes: res.asistentes });
      m.innerHTML = `<div class="caja" role="dialog">
        <div class="ic"><svg viewBox="0 0 24 24">${conf ? `<path d="M5 12.500l4.500 4.500L19 7.500"/>` : `<path d="M20 12H4M10 6l-6 6 6 6"/>`}</svg></div>
        <h2>${conf ? "¡Gracias! Tu asistencia quedó confirmada" : "Gracias por avisarnos"}</h2>
        <p>${conf ? `Te esperamos${cfg.fecha ? ` el ${fmtFechaCorta(cfg.fecha)}` : ""}.` : "Lamentamos que no puedas acompañarnos. Siempre estarás en nuestro corazón."}${opts.preview ? "<br><em>(Vista previa: no se guardó nada)</em>" : ""}</p>
        <div class="acciones"><button class="si" id="m-ok">Listo</button></div></div>`;
      m.querySelector("#m-ok").addEventListener("click", cerrar);
    } catch (e) {
      si.disabled = no.disabled = false; si.textContent = conf ? "Sí, confirmar" : "Sí, no asistiré";
      err.hidden = false; err.textContent = "No se pudo guardar tu respuesta. Revisa tu conexión e inténtalo otra vez.";
    }
  };
  pregunta();
}

/* ---------- detalles visuales ---------- */
function rasgar(el) {
  const pts = [], n = 34, j = () => Math.random() * 2.8;
  for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(2)}% ${(j() + 0.5).toFixed(2)}%`);
  for (let i = n; i >= 0; i--) pts.push(`${(i / n * 100).toFixed(2)}% ${(100 - j() - 0.5).toFixed(2)}%`);
  el.style.clipPath = `polygon(${pts.join(",")})`;
}

let timer;
function cuentaRegresiva(root, f, hora) {
  const [hh, mm] = /^\d{1,2}:\d{2}/.test(hora || "") ? hora.split(":").map(Number) : [0, 0];
  const meta = new Date(f.Y, f.M - 1, f.D, hh, mm).getTime();
  const set = (id, v) => {
    const e = root.querySelector("#" + id);
    if (!e || e.textContent === String(v)) return;
    e.textContent = v;
    e.classList.remove("pop"); void e.offsetWidth; e.classList.add("pop"); // pequeño "salto" al cambiar el número
  };
  const tick = () => {
    let s = Math.max(0, Math.floor((meta - Date.now()) / 1000));
    set("cd-d", Math.floor(s / 86400)); s %= 86400;
    set("cd-h", pad(Math.floor(s / 3600))); s %= 3600;
    set("cd-m", pad(Math.floor(s / 60))); set("cd-s", pad(s % 60));
  };
  clearInterval(timer); tick(); timer = setInterval(() => { if (!root.isConnected) clearInterval(timer); else tick(); }, 1000);
}

function musica(root) {
  const a = root.querySelector("#audio"), b = root.querySelector("#play"), p = root.querySelector("#ico-play");
  const prog = root.querySelector("#prog"), bola = root.querySelector("#bola"), pl = root.querySelector("#player"), fab = root.querySelector("#fab");
  const PLAY = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4z";
  const PAUSE = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14H9V8h2zm4 0h-2V8h2z";
  const alternar = () => (a.paused ? a.play().catch(() => {}) : a.pause());
  b.addEventListener("click", alternar);
  if (fab) fab.addEventListener("click", alternar);
  a.addEventListener("play", () => { p.setAttribute("d", PAUSE); pl.classList.add("sonando"); fab && fab.classList.add("sonando"); });
  a.addEventListener("pause", () => { p.setAttribute("d", PLAY); pl.classList.remove("sonando"); fab && fab.classList.remove("sonando"); });
  a.addEventListener("timeupdate", () => { const x = a.duration ? a.currentTime / a.duration * 100 : 0; prog.style.width = x + "%"; bola.style.left = x + "%"; });
}

// La foto de portada se mueve más despacio que el resto al hacer scroll
function paralaje(root) {
  const h = root.querySelector(".hero .foto");
  if (!h) return;
  const sc = root.closest(".prev-wrap") || window;
  let ocupado = false;
  const al = () => {
    if (ocupado) return; ocupado = true;
    requestAnimationFrame(() => { const y = sc === window ? window.scrollY : sc.scrollTop; h.style.setProperty("--py", Math.min(y, 900) * 0.28 + "px"); ocupado = false; });
  };
  sc.addEventListener("scroll", al, { passive: true });
}

function revelar(root) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("v"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  root.querySelectorAll(".rev").forEach(el => io.observe(el));
}
