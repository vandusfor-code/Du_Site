// Tema "floral" (blanco y dorado, con flores) para la invitación.
// Usa los mismos datos de la invitación; solo cambia la presentación. Se activa con cfg.tema = "floral".
import { registrarTema, cuentaRegresiva, musica, pintarEstado, rasgar, revelar } from "./invitacion.js";
import { esc, pad, parseFecha, MESES, fmtFechaCorta, fmtHora, urlSegura, resolverFoto, esEjemplo, ICONOS, COLORES_VEST } from "./util.js";
import * as A from "./adornos.js";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const reducido = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Las ilustraciones de ejemplo no combinan con este diseño: solo se muestran fotos reales.
const fotoReal = u => (u && !esEjemplo(u) ? resolverFoto(u) : "");

const texto = n => String(n).replace(/\n/g, "<br>");
function textoColores(cols) {
  const nombres = (cols || []).map(c => (COLORES_VEST.find(x => x.c === c) || {}).n).filter(Boolean).map(n => n.toLowerCase());
  if (!nombres.length) return "";
  const lista = nombres.length > 1 ? nombres.slice(0, -1).join(", ") + " y " + nombres.slice(-1) : nombres[0];
  return `Por favor, evita la siguiente gama de colores: ${lista}.`;
}

/* ---------- añadir a calendario ---------- */
const p2 = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
const ymdhms = d => `${ymd(d)}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
function eventoCal(cfg) {
  const f = parseFecha(cfg.fecha);
  if (!f) return null;
  const h = /^\d{1,2}:\d{2}/.test(cfg.ceremonia.hora || "") ? cfg.ceremonia.hora.split(":").map(Number) : null;
  let ini, fin;
  if (h) { const a = new Date(f.Y, f.M - 1, f.D, h[0], h[1]); ini = ymdhms(a); fin = ymdhms(new Date(a.getTime() + 6 * 3600e3)); }
  else { ini = ymd(new Date(f.Y, f.M - 1, f.D)); fin = ymd(new Date(f.Y, f.M - 1, f.D + 1)); }
  return { titulo: `Boda de ${cfg.novio} y ${cfg.novia}`, lugar: [cfg.ceremonia.nombre, cfg.ceremonia.dir].filter(Boolean).join(", "), ini, fin, dia: !h };
}
const urlGoogle = e => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.titulo)}&dates=${e.ini}/${e.fin}&details=${encodeURIComponent("¡Te esperamos!")}&location=${encodeURIComponent(e.lugar)}`;
function descargarIcs(e) {
  const v = e.dia ? ";VALUE=DATE" : "";
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Invitacion de boda//ES", "BEGIN:VEVENT", `UID:${Date.now()}@invitacion-boda`, `DTSTAMP:${ymdhms(new Date())}`,
    `DTSTART${v}:${e.ini}`, `DTEND${v}:${e.fin}`, `SUMMARY:${e.titulo}`, `LOCATION:${e.lugar.replace(/[,;]/g, " ")}`, "DESCRIPTION:¡Te esperamos!", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  a.download = "boda.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- calendario (lunes a domingo) ---------- */
function calFloral(f) {
  const primero = (new Date(f.Y, f.M - 1, 1).getDay() + 6) % 7;
  const dias = new Date(f.Y, f.M, 0).getDate();
  let h = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"].map(x => `<div class="h">${x}</div>`).join("");
  for (let i = 0; i < primero; i++) h += `<div></div>`;
  for (let d = 1; d <= dias; d++) {
    h += d === f.D
      ? `<div class="d hoy"><span>${d}</span><svg viewBox="0 0 40 40"><path d="M20 35S5 25 5 14.500C5 9 9 6 13 6c3 0 5.500 1.700 7 4.200C21.500 7.700 24 6 27 6c4 0 8 3 8 8.500C35 25 20 35 20 35z"/></svg></div>`
      : `<div class="d">${d}</div>`;
  }
  return h;
}

/* ---------- partes de la invitación ---------- */
const flor = (v, pos, extra = "") => `<div class="f-flor ${pos}" style="${extra}">${A.ramillete(v)}</div>`;
const papel = (cont, cls = "", anim = "up") => `<div class="f-papel rev ${cls}" data-a="${anim}"><div class="f-papel-in" data-roto="1">${cont}</div></div>`;

function monograma(cfg, cls) {
  const m = cfg.monograma ? resolverFoto(cfg.monograma) : "";
  if (m) return `<img class="${cls}" src="${esc(m)}" alt="Monograma ${esc(cfg.novio)} y ${esc(cfg.novia)}">`;
  const a = (cfg.novio || "").trim().charAt(0).toUpperCase(), b = (cfg.novia || "").trim().charAt(0).toUpperCase();
  return `<div class="${cls} f-mono-txt" aria-label="Monograma"><span>${esc(a)}</span><i></i><span>${esc(b)}</span></div>`;
}

function itinerarioHTML(cfg) {
  const items = (cfg.itinerario || []).filter(x => x.t && x.t.trim());
  if (!items.length) return "";
  const filas = items.map((x, i) => {
    const lado = i % 2 ? "d" : "i";
    const mapa = urlSegura(x.mapa) ? `<a class="ev-mapa" href="${esc(urlSegura(x.mapa))}" target="_blank" rel="noopener">Ver ubicación</a>` : "";
    const ico = `<span class="ev-ico">${(ICONOS[x.ic] || ICONOS.estrella).svg}</span>`;
    const txt = `<span class="ev-txt">${x.h ? `<em>${fmtHora(x.h).toLowerCase()}</em>` : ""}<b>${esc(x.t)}</b>${mapa}</span>`;
    return `<div class="ev ${lado} rev" data-a="${lado === "i" ? "left" : "right"}" style="grid-column:${lado === "i" ? 1 : 2};grid-row:${i + 1};transition-delay:${(i * 0.14).toFixed(2)}s">${lado === "i" ? txt + ico : ico + txt}<i class="nodo"></i></div>`;
  }).join("");
  return `<section class="f-itin"><div class="f-flor tr s2">${A.ramillete(1)}</div>${papel(`<h2 class="f-h">ITINERARIO</h2><div class="linea rev" data-a="none">${filas}</div>`, "f-papel-itin")}</section>`;
}

function lugarHTML(titulo, l, foto) {
  const mapa = urlSegura(l.mapa), hora = fmtHora(l.hora), img = fotoReal(foto);
  return `<div class="f-lugar-blk">
    ${img ? `<div class="f-arco rev" data-a="zoom"><img src="${esc(img)}" alt="${esc(titulo)}" loading="lazy"></div>` : ""}
    ${papel(`<h2 class="f-h">${esc(titulo)}</h2>
      <div class="f-lugar-fila">${hora ? `<div class="f-hora">${esc(hora.toLowerCase().replace(" ", " "))}</div><span class="f-vlinea"></span>` : ""}
      <div class="f-lugar-t"><b>${esc(l.nombre)}</b>${l.dir ? `<small>${esc(l.dir)}</small>` : ""}</div></div>
      ${mapa ? `<a class="f-btn" href="${esc(mapa)}" target="_blank" rel="noopener">Ver ubicación</a>` : ""}`, "f-papel-lugar")}
  </div>`;
}

/* ---------- construcción ---------- */
function render(root, cfg, guest, opts = {}) {
  const f = parseFecha(cfg.fecha);
  const dt = f ? new Date(f.Y, f.M - 1, f.D) : null;
  const rec = cfg.recepcion.mismo ? null : cfg.recepcion;
  const mensaje = (cfg.mensaje || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const finales = (cfg.fotos && cfg.fotos.final || []).map(fotoReal).filter(Boolean);
  const portada = fotoReal(cfg.portada);
  const cal = eventoCal(cfg);
  const nota = textoColores(cfg.vestimenta.colores);

  root.className = "inv floral anim";
  root.style.setProperty("--c", "#A8843B");
  root.style.setProperty("--c-osc", "#8C6B2E");
  root.style.setProperty("--script", "'Pinyon Script','Great Vibes',cursive");
  root.style.setProperty("--serif", "'Cormorant Garamond',Georgia,serif");

  root.innerHTML = `${A.DEFS}
  ${opts.preview ? `<div class="vista-previa">Vista previa: así verá tu invitación quien la reciba. Los botones de confirmación no guardan nada aquí.</div>` : ""}

  <section class="f-portal">
    <div class="f-portal-top">NUESTRA BODA</div>
    ${monograma(cfg, "f-portal-mono")}
    ${f ? `<div class="f-portal-fecha">${pad(f.D)} · ${pad(f.M)} · ${f.Y}</div>` : ""}
    <div class="f-portal-sigue"><span>Desliza</span><i></i></div>
  </section>

  <section class="f-hero">
    ${flor(0, "tl")}${flor(1, "br s2")}
    ${portada ? `<div class="f-arco f-arco-portada rev" data-a="zoom"><img src="${esc(portada)}" alt="Portada"></div>` : ""}
    ${papel(`${monograma(cfg, "f-mono-sm")}
      <p class="f-honor">TENEMOS EL HONOR DE INVITARTE A NUESTRA BODA</p>
      <h1 class="f-nombres"><span>${esc(cfg.novio)}</span><i>&amp;</i><span>${esc(cfg.novia)}</span></h1>
      ${guest ? `<p class="f-para">Invitación para<br><b>${esc(guest.nombre)}</b></p>` : ""}`, "f-papel-nombres")}
    ${cal ? `<div class="f-cart-wrap rev" data-a="up">
      <button class="f-cartucho" data-cal aria-haspopup="true"><span class="f-cart-bg">${A.cartucho()}</span><span class="f-cart-t">AÑÁDELO<br>A TU<br>CALENDARIO</span></button>
      <div class="f-borla">${A.borla()}</div>
      <div class="f-calmenu" hidden><a data-g href="${esc(urlGoogle(cal))}" target="_blank" rel="noopener">Google Calendar</a><button data-ics>Apple / Outlook (.ics)</button></div>
    </div>` : ""}
  </section>

  ${cfg.versiculo ? `<section class="f-sec f-verso">${papel(`<div class="f-orn">${A.ramaOro(5)}</div><p class="f-cita">“${esc(cfg.versiculo)}”${cfg.cita ? `<br><span>— ${esc(cfg.cita)}</span>` : ""}</p>`, "f-papel-verso")}</section>` : ""}

  ${cfg.cancion ? `<section class="f-sec f-sec-player">${papel(`
    <div class="player" id="player">
      <p class="indic">Dale play para escuchar nuestra canción</p>
      <div class="barra"><i id="prog"></i><b id="bola"></b></div>
      <div class="controles"><button class="play" id="play" aria-label="Reproducir canción"><svg viewBox="0 0 24 24"><path id="ico-play" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4z"/></svg></button><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
      <audio id="audio" preload="none" loop src="${esc(cfg.cancion)}"></audio>
    </div>`, "f-papel-player")}</section>` : ""}

  ${f ? `<section class="f-sec f-fecha">
    ${flor(0, "tr s3")}
    ${papel(`${mensaje.length ? `<p class="f-cita f-cita-2">${mensaje.map(p => esc(p)).join("<br><br>")}</p>` : ""}
      <div class="f-mes">${MESES[f.M - 1].toUpperCase()}</div>
      <div class="f-fecha-fila"><div class="f-lado"><span>${DIAS[dt.getDay()].toUpperCase()}</span></div><div class="f-dia">${f.D}</div><div class="f-lado"><span>${f.Y}</span></div></div>
      <div class="f-gran">El gran día</div>
      <div class="f-mes-anio">${MESES[f.M - 1].toUpperCase()} ${f.Y}</div>
      <div class="cal">${calFloral(f)}</div>`, "f-papel-fecha")}
  </section>
  <section class="f-sec f-cuenta rev" data-a="up">
    <h2 class="f-h f-h-grande">FALTAN</h2>
    <div class="f-digitos"><div><b id="cd-d">0</b><small>DÍAS</small></div><i>:</i><div><b id="cd-h">00</b><small>HORAS</small></div><i>:</i><div><b id="cd-m">00</b><small>MINUTOS</small></div><i>:</i><div><b id="cd-s">00</b><small>SEGUNDOS</small></div></div>
  </section>` : ""}

  ${cfg.ceremonia.nombre || (rec && rec.nombre) ? `<section class="f-sec f-lugares">
    ${flor(1, "bl s3")}
    ${cfg.ceremonia.nombre ? lugarHTML(cfg.recepcion.mismo ? "CEREMONIA Y RECEPCIÓN" : "CEREMONIA", cfg.ceremonia, cfg.ceremonia.foto) : ""}
    ${rec && rec.nombre ? lugarHTML("RECEPCIÓN", rec, rec.foto) : ""}
  </section>` : ""}

  ${itinerarioHTML(cfg)}

  <section class="f-sec f-vest">
    ${flor(0, "tr s3")}
    <div class="f-cart-wrap f-cart-vest rev" data-a="left"><div class="f-cartucho est"><span class="f-cart-bg">${A.cartucho()}</span><span class="f-cart-t">CÓDIGO<br>DE<br>VESTIMENTA</span></div><div class="f-borla">${A.borla()}</div></div>
    ${papel(`<div class="f-tipo">${esc(cfg.vestimenta.tipo).toUpperCase()}</div>
      ${nota ? `<p class="f-nota">${esc(nota)}</p>` : ""}${cfg.vestimenta.nota ? `<p class="f-nota">${esc(cfg.vestimenta.nota)}</p>` : ""}
      ${cfg.vestimenta.colores.length ? `<div class="colores">${cfg.vestimenta.colores.map((x, i) => `<i style="background:${esc(x)};--i:${i}"></i>`).join("")}</div>` : ""}`, "f-papel-vest", "right")}
  </section>

  ${cfg.sobres.activo && cfg.sobres.texto ? `<section class="f-sec f-regalo">${papel(`<div class="f-ico-regalo">${A.iconoRegalo}</div><h2 class="f-h">LLUVIA DE SOBRES</h2><p class="f-nota">${esc(cfg.sobres.texto)}</p>`, "f-papel-regalo")}</section>` : ""}

  <section class="f-sec f-confirmar" id="confirmar">
    ${flor(1, "bl s2")}
    ${papel(`<h2 class="f-h">CONFIRMAR ASISTENCIA</h2>
      ${cfg.confirmarAntes ? `<p class="f-nota">Agradecemos que confirmes tu asistencia antes del ${fmtFechaCorta(cfg.confirmarAntes)}</p>` : `<p class="f-nota">Agradecemos que confirmes tu asistencia</p>`}
      ${guest && guest.pases > 1 ? `<p class="f-cupos-txt">Esta invitación es válida para <b>${guest.pases}</b> personas</p>` : ""}
      <div class="estado" id="estado"></div>`, "f-papel-confirma")}
    <div class="f-sello rev" data-a="zoom">${A.sello(2)}</div>
  </section>

  <section class="f-sec f-final rev" data-a="up">
    <h2 class="f-te-esperamos">¡Te esperamos!</h2>
    ${finales.length ? `<div class="mosaico">${finales.map((s, i) => `<figure class="foto tiene rev" data-a="zoom" style="transition-delay:${(i * 0.14).toFixed(2)}s"><img src="${esc(s)}" alt="Foto" loading="lazy"></figure>`).join("")}</div>` : ""}
    <div class="f-rama">${A.ramaOro(8)}</div>
  </section>
  <footer class="credito"><span>Diseñado por</span><b>Duván Ramos</b></footer>
  ${cfg.cancion ? `<button class="fab" id="fab" aria-label="Música">${A.iconoNota}</button>` : ""}`;

  root.querySelectorAll("[data-roto]").forEach(rasgar);
  if (f) cuentaRegresiva(root, f, cfg.ceremonia.hora);
  if (cfg.cancion) musica(root);
  pintarEstado(root, cfg, guest, opts);
  revelar(root);

  // Añadir a calendario
  const btn = root.querySelector("[data-cal]");
  if (btn) {
    const menu = root.querySelector(".f-calmenu");
    btn.addEventListener("click", e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    root.querySelector("[data-ics]").addEventListener("click", () => { descargarIcs(cal); menu.hidden = true; });
    root.querySelector("[data-g]").addEventListener("click", () => { menu.hidden = true; });
    document.addEventListener("click", e => { if (!e.target.closest(".f-cart-wrap")) menu.hidden = true; });
  }

  return portadaLazo(root, cfg, guest);
}

/* ---------- entrada: panel bordado (foto real) que se abre en dos puertas ---------- */
function arte(cfg, guest) {
  const f = parseFecha(cfg.fecha);
  return `<div class="f-arte">
    <div class="f-foto"></div>
    ${guest ? `<div class="f-c-cupos"><span>Hemos reservado</span><b>${guest.pases}</b><span>${guest.pases === 1 ? "cupo" : "cupos"} para ti</span></div>` : ""}
    <div class="f-c-toca"><i></i><span>Toca la invitación para abrirla</span></div>
  </div>`;
}

function portadaLazo(root, cfg, guest) {
  const c = document.createElement("div");
  c.className = "f-cover";
  c.setAttribute("role", "button");
  c.setAttribute("tabindex", "0");
  c.setAttribute("aria-label", "Abrir la invitación");
  // el lienzo con el lazo es una pieza aparte (recorte de la foto) para poder caer solo
  const lienzo = new URL("../img/lazo-lienzo.webp", import.meta.url).href;
  c.innerHTML = `<div class="f-escena">
    <div class="f-puerta izq">${arte(cfg, guest)}</div>
    <div class="f-puerta der">${arte(cfg, guest)}</div>
  </div>
  <div class="f-lienzo" aria-hidden="true"><div class="f-lienzo-in"><img alt="" src="${lienzo}" draggable="false"></div></div>`;
  document.body.appendChild(c);
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const quitar = () => { document.body.style.overflow = prev; c.remove(); };
  let abierto = false;
  // [cae el lienzo, se abren las puertas, se libera el scroll, se retira la portada]
  const t = reducido() ? [0, 150, 500, 700] : [650, 1750, 3400, 4300];
  const abrir = () => {
    if (abierto) return;
    abierto = true;
    c.classList.add("suelta");                       // el nudo se afloja
    setTimeout(() => c.classList.add("cae"), t[0]);  // el lienzo cae con suavidad
    setTimeout(() => {                               // y se abre la segunda pantalla
      c.classList.add("abre");
      root.classList.add("listo");
      const a = root.querySelector("#audio");
      if (a) a.play().catch(() => {});
    }, t[1]);
    setTimeout(() => { document.body.style.overflow = prev; }, t[2]);
    setTimeout(() => c.remove(), t[3]);
  };
  c.addEventListener("click", abrir);
  c.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } });
  return quitar;
}

registrarTema("floral", render);
