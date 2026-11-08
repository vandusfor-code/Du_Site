// Editor de la invitación: formulario, invitaciones personalizadas y respuestas (RSVP).
// La lógica y los servicios (Supabase, subida de archivos, vista previa) son los mismos de siempre;
// aquí solo cambia la presentación.
import { rpc, subirArchivo, comprimirImagen } from "./api.js";
import { esc, DEFAULT_CONFIG, CANCIONES, esEjemplo, resolverFoto, mezclar, clonar, getPath, setPath, PALETAS, FUENTES_PRINCIPAL, FUENTES_SECUNDARIA, COLORES_VEST, TIPOS_VEST, ICONOS, urlSegura, MESES, parseFecha } from "./util.js";
import { renderInvitacion } from "./invitacion.js";
import "./tema-floral.js";   // tema blanco y dorado (se activa con cfg.tema)

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MAX_FINAL = 6;
// 12 de abril de 2027
const fechaLeible = iso => { const f = parseFecha(iso); return f ? `${f.D} de ${MESES[f.M - 1]} de ${f.Y}` : ""; };

/* ---------- iconografía lineal ---------- */
const svg = (p, n = 24, sw = 1.5) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  anillos: svg('<circle cx="8.5" cy="14.5" r="5"/><circle cx="15.5" cy="14.5" r="5"/><path d="M10.500 4.500L12 3l1.500 1.500L12 7z"/>'),
  imagen: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.600"/><path d="M21 16l-5-5-9 9"/>'),
  paleta: svg('<path d="M12 3a9 9 0 1 0 0 18c1.300 0 1.900-.9 1.900-1.800 0-1.400-1.100-1.700-1.100-2.800 0-1 .8-1.700 1.800-1.700H17a4 4 0 0 0 4-4c0-4.200-4-7.700-9-7.700z"/><circle cx="7.500" cy="11.500" r="1"/><circle cx="10" cy="7.500" r="1"/><circle cx="15" cy="7.500" r="1"/>'),
  musica: svg('<path d="M9 18V5.500l11-2V16"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="17.500" cy="16" r="2.500"/>'),
  cita: svg('<path d="M4 7h6v6.500A4.500 4.500 0 0 1 5.500 18M14 7h6v6.500A4.500 4.500 0 0 1 15.500 18"/>'),
  calendario: svg('<rect x="3.500" y="5" width="17" height="15" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/>'),
  lugar: svg('<path d="M12 21s-7-6-7-11.200A7 7 0 0 1 19 9.800C19 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.500"/>'),
  vestimenta: svg('<path d="M12 8a2.200 2.200 0 1 0-2.200-2.200M12 8v1.800l8.500 5.700a1.400 1.400 0 0 1-.8 2.500H4.300a1.400 1.400 0 0 1-.8-2.500L12 9.800"/>'),
  reloj: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  sobre: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.500 7l8.500 6 8.500-6"/>'),
  confirma: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.500l2.800 2.800L16 9.500"/>'),
  fotos: svg('<rect x="3" y="7" width="13" height="13" rx="2"/><path d="M8 7V5.500A1.500 1.500 0 0 1 9.500 4H19a2 2 0 0 1 2 2v9.500a1.500 1.500 0 0 1-1.500 1.500H18"/>'),
  lapiz: svg('<path d="M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 3L8 18.500z"/><path d="M14.500 6.500l3 3"/>', 24, 1.600),
  invit: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.500 7l8.500 6 8.500-6"/>', 24, 1.600),
  barras: svg('<path d="M6 20v-8M12 20V5M18 20v-5"/>', 24, 1.800),
  ojo: svg('<path d="M1.500 12S5.500 5 12 5s10.500 7 10.500 7-4 7-10.500 7S1.500 12 1.500 12z"/><circle cx="12" cy="12" r="3"/>', 20, 1.600),
  camara: svg('<path d="M4 8h3l1.500-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.500"/>', 20, 1.600),
  check: svg('<path d="M5 12.500l4.500 4.500L19 7"/>', 20, 2),
  chevron: svg('<path d="M6 9l6 6 6-6"/>', 18, 1.800),
  mas: svg('<path d="M12 5v14M5 12h14"/>', 16, 2),
  lupa: svg('<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>', 20, 1.700),
  nota: svg('<path d="M9 18V5.500l11-2V16"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="17.500" cy="16" r="2.500"/>', 26, 1.500)
};
const KEBAB_V = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.700"/><circle cx="12" cy="12" r="1.700"/><circle cx="12" cy="19" r="1.700"/></svg>`;
const PLAY = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5.500v13a1 1 0 0 0 1.500.9l10.500-6.500a1 1 0 0 0 0-1.800L9.500 4.600A1 1 0 0 0 8 5.500z"/></svg>`;
const PAUSA = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="6.500" y="5" width="4" height="14" rx="1"/><rect x="13.500" y="5" width="4" height="14" rx="1"/></svg>`;

// Rama de olivo decorativa (esquina del encabezado)
function ramaOlivo() {
  const hojas = [];
  const pts = [[84, 20], [96, 44], [108, 70], [118, 98], [126, 128], [132, 158]];
  pts.forEach(([x, y], i) => {
    const t = i % 2 ? 1 : -1;
    hojas.push(`<ellipse cx="${x + t * 17}" cy="${y - 4}" rx="17" ry="6" transform="rotate(${t * -32} ${x + t * 17} ${y - 4})" fill="#777B55" opacity="${0.55 + i * 0.05}"/>`);
    hojas.push(`<ellipse cx="${x - t * 15}" cy="${y + 8}" rx="15" ry="5.500" transform="rotate(${t * 36} ${x - t * 15} ${y + 8})" fill="#777B55" opacity="${0.45 + i * 0.05}"/>`);
  });
  return `<svg class="rama" viewBox="0 0 170 200" aria-hidden="true"><path d="M70 0C96 36 118 92 136 200" fill="none" stroke="#6B6F49" stroke-width="2" opacity=".8"/>${hojas.join("")}</svg>`;
}

export async function iniciarPanel(root, key) {
  // ---------- carga inicial ----------
  root.innerHTML = `<div class="centro"><p><span class="spin"></span> Cargando tu panel…</p></div>`;
  let data;
  try { data = await rpc("boda_admin_get", { p_key: key }); }
  catch (e) {
    root.innerHTML = `<div class="centro"><div><h1>Enlace no válido</h1><p>${e.code === "clave_invalida" ? "Este enlace de administración no es correcto. Pídele a quien te lo envió que te lo comparta de nuevo." : "No pudimos conectarnos. Revisa tu internet e inténtalo otra vez."}</p></div></div>`;
    return;
  }
  const eventoId = data.evento_id;
  let cfg = mezclar(DEFAULT_CONFIG, data.config || {});
  let invitados = data.invitados || [];
  const draftKey = "boda-borrador-" + eventoId;
  let borrador = null;
  try { const b = JSON.parse(localStorage.getItem(draftKey) || "null"); if (b && b.dirty) borrador = b; } catch {}
  let tab = "datos", dirty = false, saving = false;
  let guardadoAlgunaVez = !!(data.config && data.config.novio);
  let resultadoNuevo = null, filtro = "todos", refreshTimer = null, nuevoPases = 1;
  let listaCanciones = false, menuCancion = false;
  let busqueda = "", filtroInv = "todos";   // buscador de invitaciones
  const mapaAbierto = new Set();   // momentos del itinerario con el campo de Maps visible

  const base = location.origin + location.pathname.replace(/index\.html$/, "");
  const enlace = c => `${base}?i=${c}`;

  root.innerHTML = `<div class="adm">
    <header class="top"><div class="top-in">
      <div class="mono" id="mono"></div><span class="vsep"></span><span class="tag">Tu invitación</span>
      <div class="top-r"><button class="pill" id="b-prev">${I.ojo}<span>Vista previa</span></button>
      <button class="kebab" id="b-menu" aria-label="Más opciones" aria-haspopup="true">${KEBAB_V}</button></div>
      <div class="menu" id="menu"><button data-m="copiar">Copiar enlace de este panel</button><button data-m="csv">Descargar lista de invitados</button><button data-m="descartar">Descartar cambios sin guardar</button></div>
    </div></header>
    <main id="main"></main>
    <div class="savebar" id="savebar"><div class="savebar-in"><span>Tienes cambios sin guardar</span><button class="sb-btn" data-save>Guardar</button></div></div>
    <nav class="bnav" aria-label="Secciones"><div class="bnav-in">
      <button data-tab="datos">${I.lapiz}<span>Editar</span></button>
      <button data-tab="inv">${I.invit}<span>Invitaciones</span><em class="n" id="n-inv"></em></button>
      <button data-tab="res">${I.barras}<span>Respuestas</span><em class="n" id="n-res"></em></button>
    </div></nav>
  </div><div id="toast"></div>`;
  const main = $("#main", root);

  // ---------- utilidades de interfaz ----------
  let toastT;
  const toast = (m, err) => { const t = $("#toast"); t.textContent = m; t.className = "on" + (err ? " err" : ""); clearTimeout(toastT); toastT = setTimeout(() => (t.className = ""), 3400); };

  const dialogo = (titulo, cuerpo, botones) => new Promise(res => {
    const d = document.createElement("div");
    d.className = "dlg";
    d.innerHTML = `<div class="dlg-c"><h3>${titulo}</h3>${cuerpo}<div class="dlg-b">${botones.map((b, i) => `<button class="btn ${b.cls || ""}" data-i="${i}">${b.t}</button>`).join("")}</div></div>`;
    document.body.appendChild(d);
    const fin = i => { const vals = {}; $$("[name]", d).forEach(x => (vals[x.name] = x.value)); d.classList.add("sale"); setTimeout(() => d.remove(), 180); res({ i, vals }); };
    $$("[data-i]", d).forEach(b => (b.onclick = () => fin(+b.dataset.i)));
    d.addEventListener("click", e => { if (e.target === d) fin(-1); });
    const first = $("input", d); if (first) first.focus();
  });

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); }
    catch { const t = document.createElement("textarea"); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    toast("Enlace copiado");
  }

  // Orden: novia & novio (como en la invitación)
  const nombreCorto = () => [cfg.novia, cfg.novio].filter(Boolean).join(" y ") || "los novios";
  const mensajeWA = nombre => `Hola ${nombre} 💌 ¡${nombreCorto()} te invitan a su boda! Abre tu invitación personal aquí:`;

  // ---------- estado guardado / borrador ----------
  function actualizarEstado() {
    const sb = $("#savebar"); sb.classList.toggle("on", dirty && tab === "datos");
    const fb = $("#f-save");
    if (fb) {
      fb.disabled = saving;
      fb.classList.toggle("guardado", !dirty && !saving);
      fb.innerHTML = saving ? `<span class="spin"></span> Guardando…` : dirty ? `${I.check} Guardar cambios` : `${I.check} Todo guardado`;
    }
    const bs = $(".sb-btn", sb); if (bs) bs.disabled = saving;
    // monograma del encabezado
    const ini = (cfg.novia || "W").trim().charAt(0).toUpperCase(), ini2 = (cfg.novio || "M").trim().charAt(0).toUpperCase();
    $("#mono").innerHTML = `${esc(ini)}<i>&amp;</i>${esc(ini2)}`;
  }
  function marcarCambio() {
    dirty = true; actualizarEstado();
    try { localStorage.setItem(draftKey, JSON.stringify({ cfg, dirty: true })); } catch {}
  }
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  async function guardar() {
    if (saving) return;
    cfg.novio = cfg.novio.trim(); cfg.novia = cfg.novia.trim();
    saving = true; actualizarEstado();
    try {
      await rpc("boda_admin_guardar", { p_key: key, p_config: cfg });
      dirty = false; guardadoAlgunaVez = true;
      try { localStorage.removeItem(draftKey); } catch {}
      toast("Guardado. Ya se actualizó en todas las invitaciones");
    } catch (e) { toast("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.", true); }
    saving = false; actualizarEstado();
  }

  // ---------- reproductor del editor (una sola canción a la vez) ----------
  const audio = new Audio(); audio.preload = "none";
  let sonando = "";
  const durs = {};
  const fmtDur = s => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "—:—");
  function refrescarPlay() {
    $$("[data-play]", root).forEach(b => { const on = b.dataset.play === sonando && !audio.paused; b.innerHTML = on ? PAUSA : PLAY; b.classList.toggle("on", on); b.setAttribute("aria-label", on ? "Pausar" : "Reproducir"); });
  }
  audio.addEventListener("play", refrescarPlay); audio.addEventListener("pause", refrescarPlay); audio.addEventListener("ended", refrescarPlay);
  function reproducir(url) {
    if (sonando === url && !audio.paused) { audio.pause(); return; }
    if (sonando !== url) { audio.src = url; sonando = url; }
    audio.play().catch(() => toast("No se pudo reproducir la canción", true));
  }
  function cargarDuracion(url) {
    if (!url) return;
    const poner = () => $$("[data-dur]", root).forEach(e => { if (e.dataset.dur === url && durs[url] != null) e.textContent = fmtDur(durs[url]); });
    if (durs[url] !== undefined) { poner(); return; }
    durs[url] = null;
    const a = new Audio(); a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => { durs[url] = a.duration; poner(); });
    a.src = url;
  }
  const infoCancion = url => { const c = CANCIONES.find(x => x.url === url); return c ? { t: c.t, a: c.a } : { t: cfg.cancionNombre || "Tu canción", a: "Subida por ti" }; };
  const textoDur = url => (durs[url] != null ? fmtDur(durs[url]) : "—:—");

  // Encabezado editorial con los nombres: se actualiza mientras se escribe
  const cortos = () => (cfg.novia + cfg.novio).length <= 18;   // nombres cortos caben en una línea
  function titularNombres() {
    const h = $(".edhead h1", main); if (!h) return;
    h.classList.toggle("una-linea", cortos());
    h.innerHTML = cfg.novia || cfg.novio ? `${esc(cfg.novia || "…")} <i>&amp;</i> ${esc(cfg.novio || "…")}` : `<span class="ph">Tus nombres</span>`;
  }

  // ---------- componentes del formulario ----------
  const F = (label, k, o = {}) => {
    const v = getPath(cfg, k) ?? "";
    const campo = o.type === "textarea"
      ? `<textarea data-k="${k}" rows="${o.rows || 4}" placeholder="${esc(o.ph || "")}">${esc(v)}</textarea>`
      : o.type === "date"
        ? `<div class="fecha-f"><span class="fecha-ic">${I.calendario}</span><span class="fecha-txt ${v ? "" : "ph"}">${v ? esc(fechaLeible(v)) : "Elegir fecha"}</span><input data-k="${k}" type="date" value="${esc(v)}" aria-label="${esc(label)}"></div>`
        : `<input data-k="${k}" type="${o.type || "text"}" value="${esc(v)}" placeholder="${esc(o.ph || "")}" ${o.type === "url" ? 'inputmode="url" autocapitalize="off"' : ""}>`;
    return `<label class="f"><span>${label}</span>${campo}${o.hint ? `<small>${o.hint}</small>` : ""}</label>`;
  };

  const foto1 = (k, label, hint) => {
    const u = getPath(cfg, k);
    return `<div class="f"><span>${label}</span><div class="up">
      <div class="up-prev">${u ? `<img src="${esc(resolverFoto(u))}" alt="">${esEjemplo(u) ? `<span class="ej">Ejemplo</span>` : ""}` : "Sin foto"}</div>
      <div class="up-btns"><label class="btn sec chico">${u ? (esEjemplo(u) ? "Subir tu foto" : "Cambiar foto") : "Subir foto"}<input type="file" accept="image/*" hidden data-up="${k}"></label>
      ${u ? `<button type="button" class="lnk mal" data-rm="${k}">${esEjemplo(u) ? "Quitar el ejemplo" : "Quitar"}</button>` : ""}</div></div>${hint ? `<small class="hint">${hint}</small>` : ""}</div>`;
  };

  const sec = (id, icono, titulo, sub, cuerpo) => `<section class="sec" id="sec-${id}"><div class="sec-h"><span class="sec-ic">${icono}</span><div><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ""}</div></div>${cuerpo}</section>`;

  // selector desplegable con muestra tipográfica
  const selector = (campo, etiqueta, opciones) => {
    const act = opciones[cfg[campo]] ? cfg[campo] : Object.keys(opciones)[0];
    const o = opciones[act];
    return `<div class="f sel-w"><span>${etiqueta}</span><div class="sel" data-sel="${campo}">
      <button type="button" class="sel-b" aria-haspopup="listbox" aria-expanded="false"><b class="aa" style="font-family:${o.css}">Aa</b><span class="sel-n">${o.n}</span>${I.chevron}</button>
      <ul class="sel-l" role="listbox">${Object.entries(opciones).map(([k, v]) => `<li role="option" data-val="${k}" aria-selected="${k === act}" class="${k === act ? "on" : ""}"><b class="aa" style="font-family:${v.css}">Aa</b><span style="font-family:${v.css}">${v.n}</span>${k === act ? I.check : ""}</li>`).join("")}</ul></div></div>`;
  };

  const portadaHTML = () => {
    const u = cfg.portada;
    return `<div class="cover ${u ? "" : "vacia"}">${u ? `<img src="${esc(resolverFoto(u))}" alt="Portada">` : `<span>Aún no hay foto de portada</span>`}${u && esEjemplo(u) ? `<span class="ej">Ejemplo</span>` : ""}
      <label class="btn-foto">${I.camara}<span>${u ? (esEjemplo(u) ? "Subir tu foto" : "Cambiar foto") : "Subir foto"}</span><input type="file" accept="image/*" hidden data-up="portada"></label></div>
      <div class="cover-nota"><span>${cfg.tema === "floral" ? "En la invitación aparece enmarcada en arco, sobre los nombres. Las fotos de ejemplo no se muestran en este diseño." : "En la invitación se muestra a pantalla completa, en vertical."}</span>${u ? `<button type="button" class="lnk mal" data-rm="portada">${esEjemplo(u) ? "Quitar el ejemplo" : "Quitar"}</button>` : ""}</div>`;
  };

  const musicaHTML = () => {
    const url = cfg.cancion, tn = cfg.portada ? resolverFoto(cfg.portada) : "";
    const thumb = `<div class="thumb">${tn ? `<img src="${esc(tn)}" alt="">` : ""}<span>${I.nota}</span></div>`;
    const reproductor = url ? (() => { const m = infoCancion(url); return `
      <div class="mus">${thumb}<div class="mus-b">
        <button type="button" class="play" data-play="${esc(url)}" aria-label="Reproducir">${PLAY}</button>
        <div class="ptxt"><b>${esc(m.t)}</b><small>${esc(m.a)}</small></div>
        <span class="dur" data-dur="${esc(url)}">${textoDur(url)}</span>
        <button type="button" class="kebab sm" data-songmenu aria-label="Opciones de la canción" aria-expanded="${menuCancion}">${KEBAB_V}</button>
        <div class="menu ${menuCancion ? "on" : ""}" id="songmenu"><button data-act="cambiar">Cambiar canción</button><label class="m-item">Subir otra canción (MP3)<input type="file" accept="audio/mpeg,audio/mp4,.mp3,.m4a" hidden data-up="cancion"></label><button data-act="quitar" class="mal">Quitar música</button></div>
      </div></div>`; })()
      : `<div class="mus vacio">${thumb}<div class="mus-b"><div class="ptxt"><b>Sin música</b><small>La invitación se verá sin reproductor</small></div></div></div>`;
    const fila = (valor, t, a) => `<div class="song ${cfg.cancion === valor ? "on" : ""}" data-song="${esc(valor)}" role="radio" aria-checked="${cfg.cancion === valor}" tabindex="0">
        <span class="radio">${cfg.cancion === valor ? I.check : ""}</span><div class="ptxt"><b>${esc(t)}</b><small>${esc(a)}</small></div><span class="dur" data-dur="${esc(valor)}">${textoDur(valor)}</span>
        <button type="button" class="play sm" data-play="${esc(valor)}" aria-label="Reproducir">${PLAY}</button></div>`;
    const propia = cfg.cancion && !CANCIONES.some(c => c.url === cfg.cancion);
    const lista = `<div class="songlist ${listaCanciones ? "abierta" : ""}"><div class="songlist-in" role="radiogroup" aria-label="Canciones disponibles">
        ${CANCIONES.map(c => fila(c.url, c.t, c.a)).join("")}${propia ? fila(cfg.cancion, cfg.cancionNombre || "Tu canción", "Subida por ti") : ""}
        <div class="song ${!cfg.cancion ? "on" : ""}" data-song="" role="radio" aria-checked="${!cfg.cancion}" tabindex="0"><span class="radio">${!cfg.cancion ? I.check : ""}</span><div class="ptxt"><b>Sin música</b></div></div>
        <label class="btn sec chico subir-c">${I.mas}<span>Subir otra canción (MP3)</span><input type="file" accept="audio/mpeg,audio/mp4,.mp3,.m4a" hidden data-up="cancion"></label>
        <small class="hint">Máximo 8 MB. La canción elegida suena en todas las invitaciones.</small></div></div>`;
    return `${reproductor}<button type="button" class="lnk-b" data-act="lista">${listaCanciones ? "Ocultar canciones" : "Ver todas las canciones"}${I.chevron}</button>${lista}`;
  };

  const finalHTML = () => `<div class="grid-fotos">${cfg.fotos.final.map((u, i) => `<div class="t"><img src="${esc(resolverFoto(u))}" alt="">${esEjemplo(u) ? `<span class="ej">Ejemplo</span>` : ""}<button type="button" data-rm-f="${i}" aria-label="Quitar foto">×</button></div>`).join("")}
    ${cfg.fotos.final.length < MAX_FINAL ? `<label class="mas">${I.mas}<span>Agregar</span><input type="file" accept="image/*" multiple hidden data-up="fotos.final"></label>` : ""}</div>
    <small class="hint">${cfg.fotos.final.length} de ${MAX_FINAL} fotos.${cfg.fotos.final.some(esEjemplo) ? " Las de ejemplo se reemplazan al subir las tuyas." : ""}</small>`;

  // ---------- formulario completo ----------
  function faltantes() {
    const c = cfg, f = [];
    if (!c.novio || !c.novia) f.push("nombres de los novios");
    if (!c.fecha) f.push("fecha de la boda");
    if (!c.portada || esEjemplo(c.portada)) f.push("foto de portada (ahora hay una de ejemplo)");
    if (!c.ceremonia.nombre) f.push("lugar de la ceremonia");
    if (!c.ceremonia.hora) f.push("hora de la ceremonia");
    if (!urlSegura(c.ceremonia.mapa)) f.push("enlace de Google Maps de la ceremonia");
    if (!c.recepcion.mismo && !c.recepcion.nombre) f.push("lugar de la recepción");
    return f;
  }

  const pie = () => `<p class="pie-credito"><span>Diseño por</span> <b>Duvan Ramos</b></p>`;
  const cabecera = (eyebrow, titulo, sub, cls = "") => `<div class="edhead">${ramaOlivo()}<div class="eyebrow">${eyebrow}</div><h1 class="${cls}">${titulo}</h1><p>${sub}</p><div class="regla"></div></div>`;

  function pintarDatos() {
    const falta = faltantes();
    const nom = cfg.novia || cfg.novio ? `${esc(cfg.novia || "…")} <i>&amp;</i> ${esc(cfg.novio || "…")}` : `<span class="ph">Tus nombres</span>`;
    main.innerHTML = `<div class="vista">
      ${cabecera("EDITOR DE INVITACIÓN", nom, "Personaliza los detalles, el diseño y la experiencia.", cortos() ? "una-linea" : "")}
      ${borrador ? `<div class="aviso">Tienes cambios sin guardar de tu última visita.<span><button class="btn chico" data-rec>Recuperar</button><button class="lnk" data-desc>Descartar</button></span></div>` : ""}

      ${sec("novios", I.anillos, "Los novios y la fecha", "Datos principales de la boda.", `
        <div class="fila">${F("Nombre del novio", "novio", { ph: "Ej: Manuel" })}${F("Nombre de la novia", "novia", { ph: "Ej: Wendy" })}</div>
        ${F("Fecha de la boda", "fecha", { type: "date" })}`)}

      ${sec("portada", I.imagen, "Portada", "Es la primera imagen que verán tus invitados.", portadaHTML())}

      ${cfg.tema === "floral"
        ? sec("estilo", I.paleta, "Estilo de la invitación", "Esta invitación usa el diseño Blanco y dorado, con flores.", `<p class="hint" style="margin:0">El color y las tipografías ya vienen definidos para combinar con el monograma de la pareja, así que aquí no hay nada que cambiar.</p>`)
        : sec("estilo", I.paleta, "Estilo de la invitación", "Define la paleta de colores y la tipografía.", `
        <div class="pal" role="radiogroup" aria-label="Paleta de colores">${Object.entries(PALETAS).map(([k, v]) => `<button type="button" role="radio" aria-checked="${cfg.color === k}" data-color="${k}" class="${cfg.color === k ? "on" : ""}"><i style="background:${v.c}">${cfg.color === k ? I.check : ""}</i><span>${v.n}</span></button>`).join("")}</div>
        <div class="fila fila-sel">${selector("tipoPrincipal", "Tipografía principal", FUENTES_PRINCIPAL)}${selector("tipoSecundaria", "Tipografía secundaria", FUENTES_SECUNDARIA)}</div>`)}

      ${sec("musica", I.musica, "Música de fondo", "Elige la canción que sonará en tu invitación.", musicaHTML())}

      ${sec("mensaje", I.cita, "Versículo y mensaje", "Ya dejamos textos de ejemplo; cámbialos por los de ustedes.", `
        ${F("Versículo o frase", "versiculo", { type: "textarea", rows: 3 })}
        ${F("Cita del versículo", "cita", { ph: "Ej: 1 Corintios 13:13" })}
        ${F("Mensaje de los novios", "mensaje", { type: "textarea", rows: 6, hint: "Deja una línea en blanco para separar párrafos." })}
        ${foto1("fotos.mensaje", "Foto de esta sección (opcional)", "Aparece debajo del versículo, con borde de papel rasgado.")}`)}

      ${sec("calendario", I.calendario, "Calendario", "El calendario y la cuenta regresiva se arman solos con la fecha y la hora de la ceremonia.", foto1("fotos.calendario", "Foto de esta sección (opcional)", "Aparece debajo del calendario."))}

      ${sec("ceremonia", I.lugar, "Ceremonia", "¿Dónde y a qué hora se celebra?", `
        ${F("Nombre del lugar", "ceremonia.nombre", { ph: "Ej: Iglesia Nuestra Señora de…" })}
        ${F("Hora", "ceremonia.hora", { type: "time" })}
        ${F("Dirección", "ceremonia.dir", { ph: "Calle, barrio, ciudad" })}
        ${F("Enlace de Google Maps", "ceremonia.mapa", { type: "url", ph: "https://maps.app.goo.gl/…", hint: "En Google Maps busca el lugar → Compartir → Copiar enlace, y pégalo aquí." })}
        ${foto1("ceremonia.foto", "Foto del lugar (opcional)")}`)}

      ${sec("recepcion", I.lugar, "Recepción", "", `
        <label class="chk"><input type="checkbox" data-k="recepcion.mismo" data-re="1" ${cfg.recepcion.mismo ? "checked" : ""}><span><b>Es en el mismo lugar de la ceremonia</b><small>Mostraremos un solo lugar en la invitación.</small></span></label>
        ${cfg.recepcion.mismo ? "" : `
        ${F("Nombre del lugar", "recepcion.nombre", { ph: "Ej: Salón Las Marías" })}
        ${F("Hora", "recepcion.hora", { type: "time" })}
        ${F("Dirección", "recepcion.dir", { ph: "Calle, barrio, ciudad" })}
        ${F("Enlace de Google Maps", "recepcion.mapa", { type: "url", ph: "https://maps.app.goo.gl/…" })}
        ${foto1("recepcion.foto", "Foto del lugar (opcional)")}`}`)}

      ${sec("vestimenta", I.vestimenta, "Código de vestimenta", "Ya marcamos negro, morado y blanco como colores a evitar. Puedes cambiarlos.", `
        <div class="f"><span>Tipo de vestimenta</span><div class="chips">${TIPOS_VEST.map(t => `<button type="button" data-tipo="${esc(t)}" class="${cfg.vestimenta.tipo === t ? "on" : ""}">${t}</button>`).join("")}</div></div>
        <div class="f"><span>Colores que prefieren evitar</span><div class="sw">${COLORES_VEST.map(c => `<button type="button" data-vc="${c.c}" class="${cfg.vestimenta.colores.includes(c.c) ? "on" : ""}" style="background:${c.c}" title="${c.n}" aria-label="${c.n}" aria-pressed="${cfg.vestimenta.colores.includes(c.c)}"></button>`).join("")}</div><small>Toca un color para marcarlo o quitarlo. Escribimos la frase por ti.</small></div>
        ${F("Nota adicional (opcional)", "vestimenta.nota", { ph: "Ej: Será al aire libre, traer abrigo" })}
        ${foto1("fotos.vestimenta", "Foto de esta sección (opcional)", "Aparece debajo del código de vestimenta.")}`)}

      ${sec("itinerario", I.reloj, "Itinerario", "El programa del día. Si dejas la hora vacía solo se muestra el nombre.", `
        ${cfg.itinerario.map((x, i) => `<div class="it">
          <div class="it-fila">
            <select data-k="itinerario.${i}.ic" aria-label="Icono">${Object.entries(ICONOS).map(([k, v]) => `<option value="${k}" ${x.ic === k ? "selected" : ""}>${v.n}</option>`).join("")}</select>
            <input type="text" data-k="itinerario.${i}.t" value="${esc(x.t)}" placeholder="Ej: Cena">
            <input type="time" data-k="itinerario.${i}.h" value="${esc(x.h)}" aria-label="Hora">
            <button type="button" class="x" data-rm-it="${i}" aria-label="Quitar momento">×</button></div>
          ${x.mapa || mapaAbierto.has(i)
            ? `<label class="it-mapa"><span>Enlace de Google Maps <em>(opcional)</em></span><input type="url" inputmode="url" autocapitalize="off" data-k="itinerario.${i}.mapa" value="${esc(x.mapa || "")}" placeholder="https://maps.app.goo.gl/…"></label>`
            : `<button type="button" class="lnk it-add" data-it-mapa="${i}">${I.mas} Agregar enlace de Maps (opcional)</button>`}
        </div>`).join("")}
        <button type="button" class="btn sec chico" data-add-it>${I.mas} Agregar momento</button>
        <div style="margin-top:20px">${foto1("fotos.itinerario", "Foto de esta sección (opcional)", "Aparece debajo del itinerario.")}</div>`)}

      ${sec("sobres", I.sobre, "Lluvia de sobres", "", `
        <label class="chk"><input type="checkbox" data-k="sobres.activo" data-re="1" ${cfg.sobres.activo ? "checked" : ""}><span><b>Incluir “lluvia de sobres”</b><small>Un mensaje para quienes quieran hacer un detalle en efectivo.</small></span></label>
        ${cfg.sobres.activo ? F("Texto", "sobres.texto", { type: "textarea", rows: 3 }) : ""}`)}

      ${sec("confirmacion", I.confirma, "Confirmación de asistencia", "Los invitados confirman en su propia invitación; tú ves las respuestas en la pestaña Respuestas.", F("Confirmar asistencia antes del", "confirmarAntes", { type: "date" }))}

      ${sec("final", I.fotos, "Fotos finales", `Hasta ${MAX_FINAL} fotos para el cierre, bajo “¡Te esperamos!”.`, finalHTML())}

      <div class="cierre-form">
        ${falta.length ? `<p class="falta"><b>Todavía falta:</b> ${falta.join(", ")}. Puedes guardar igual y completarlo después.</p>` : `<p class="falta ok">Está todo lo importante completo.</p>`}
        <button class="btn-main" id="f-save" data-save></button>
        ${guardadoAlgunaVez && !dirty ? `<p class="siguiente">Ahora crea la invitación de cada invitado. <button class="lnk" data-gotab="inv">Ir a Invitaciones →</button></p>` : ""}
      </div>
      ${pie()}
    </div>`;
    actualizarEstado();
    refrescarPlay();
    [...CANCIONES.map(c => c.url), cfg.cancion].forEach(cargarDuracion);
  }
  // Redibuja el formulario sin que la pantalla salte
  const repintarDatos = () => { const y = window.scrollY; pintarDatos(); $(".vista", main).classList.add("sin-anim"); window.scrollTo(0, y); };

  // ---------- pestaña: invitaciones ----------
  function pintarInvitaciones() {
    const listo = cfg.novio && cfg.novia && guardadoAlgunaVez;
    main.innerHTML = `<div class="vista">
      ${cabecera("INVITACIONES", "Una para cada invitado", "Solo escribes el nombre: toda la información de la boda ya está en tu formulario.")}
      ${listo ? "" : `<div class="aviso">Primero completa y guarda los datos de tu invitación.<span><button class="btn chico" data-gotab="datos">Ir a mi invitación</button></span></div>`}
      <section class="sec"><div class="sec-h"><span class="sec-ic">${I.invit}</span><div><h2>Nueva invitación</h2><p>Se crea un enlace único. Cuando esa persona confirme, sabrás exactamente quién fue.</p></div></div>
        <div class="nuevo">
          <label class="f" style="margin:0"><span>Nombre del invitado o familia</span><input id="in-nombre" type="text" placeholder="Ej: Duvan Ramos & Familia" maxlength="120"></label>
          <div class="f" style="margin:0"><span>Personas</span><div class="pases"><button type="button" id="p-menos" aria-label="Menos">−</button><b id="p-n">${nuevoPases}</b><button type="button" id="p-mas" aria-label="Más">+</button></div></div>
        </div>
        <button class="btn-main" id="gen" style="margin-top:16px">Generar invitación</button>
        <div id="resultado">${resultadoNuevo ? htmlResultado(resultadoNuevo) : ""}</div>
        <details><summary>Agregar muchas a la vez</summary>
          <label class="f" style="margin:12px 0 10px"><textarea id="in-lote" rows="6" placeholder="Una por línea. Si quieres, agrega las personas después de una coma:&#10;Duvan Ramos & Familia, 4&#10;María López, 1"></textarea></label>
          <button class="btn sec" id="gen-lote">Generar todas</button></details>
      </section>
      <h2 class="lista-t">Tus invitaciones <em>${invitados.length}</em></h2>
      ${invitados.length ? `<div class="buscar-w">${buscador("q-inv")}<div class="chips filtros" id="chips-inv">${chipsInv()}</div></div>` : ""}
      <div class="lista" id="lista-inv">${listaInvHTML()}</div>
      ${pie()}
    </div>`;
  }

  // ----- buscador (por nombre, sin importar tildes ni mayúsculas) -----
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const coincide = i => !busqueda || norm(i.nombre).includes(norm(busqueda));
  const ESTADO_DE = { conf: "confirmado", pend: "pendiente", dec: "declinado" };
  const pasaFiltro = (i, f) => f === "todos" || i.estado === ESTADO_DE[f];
  const buscador = id => `<div class="buscar"><span class="b-ic">${I.lupa}</span><input id="${id}" type="search" inputmode="search" autocomplete="off" autocapitalize="off" placeholder="Buscar invitación por nombre" value="${esc(busqueda)}" aria-label="Buscar invitación por nombre"><button type="button" class="b-x" data-limpiar aria-label="Borrar búsqueda" ${busqueda ? "" : "hidden"}>×</button></div>`;
  const contar = e => invitados.filter(i => i.estado === e).length;
  const chipsInv = () => [["todos", "Todas", invitados.length], ["pend", "Pendientes", contar("pendiente")], ["conf", "Confirmadas", contar("confirmado")], ["dec", "No asisten", contar("declinado")]]
    .map(([k, t, n]) => `<button data-finv="${k}" class="${filtroInv === k ? "on" : ""}">${t} (${n})</button>`).join("");
  const vacioBusqueda = () => `<div class="vacio">${!invitados.length ? "Aún no has creado ninguna invitación." : `No encontramos ninguna invitación${busqueda ? ` con “${esc(busqueda)}”` : ""}${filtroInv !== "todos" ? " en este estado" : ""}.`}</div>`;
  function listaInvHTML() {
    const l = invitados.filter(i => pasaFiltro(i, filtroInv) && coincide(i));
    const nota = (busqueda || filtroInv !== "todos") && l.length ? `<div class="cuenta-b">Mostrando ${l.length} de ${invitados.length}</div>` : "";
    return l.length ? nota + l.map(tarjeta).join("") : vacioBusqueda();
  }
  // Estado detallado de cada invitación
  const detalleEstado = i => {
    const n = i.asistentes || i.pases, pers = (x) => `${x} ${x === 1 ? "persona" : "personas"}`;
    if (i.estado === "confirmado") return `Confirmó ${i.pases > 1 ? `${n} de ${pers(i.pases)}` : "su asistencia"} · ${fechaCorta(i.respondido)}`;
    if (i.estado === "declinado") return `Avisó que no asiste · ${fechaCorta(i.respondido)}`;
    return i.visto ? `${pers(i.pases)} · La abrió, aún no responde` : `${pers(i.pases)} · Creada, aún no la abre`;
  };
  const htmlResultado = r => `<div class="resultado"><b>Invitación lista para ${esc(r.nombre)}</b><div class="link">${esc(enlace(r.codigo))}</div>
    <div class="row"><button class="btn pri chico" data-copy="${r.codigo}">Copiar enlace</button><a class="btn chico" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensajeWA(r.nombre) + " " + enlace(r.codigo))}">Enviar por WhatsApp</a><a class="btn chico sec" target="_blank" rel="noopener" href="${esc(enlace(r.codigo))}">Abrir</a></div></div>`;

  const estadoTxt = { confirmado: "Confirmó", pendiente: "Pendiente", declinado: "No asiste" };
  const fechaCorta = s => s ? new Date(s).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  const tarjeta = i => `<div class="ti"><div class="top"><div><div class="nom">${esc(i.nombre)}</div>
      <div class="meta">${detalleEstado(i)}</div></div><span class="badge ${i.estado}">${estadoTxt[i.estado]}</span></div>
      <div class="acts"><button class="btn chico" data-copy="${i.codigo}">Copiar enlace</button>
      <a class="btn chico" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensajeWA(i.nombre) + " " + enlace(i.codigo))}">WhatsApp</a>
      <button class="lnk" data-edit="${i.codigo}">Editar</button><button class="lnk mal" data-del="${i.codigo}">Eliminar</button></div></div>`;

  // ---------- pestaña: respuestas (RSVP) ----------
  function pintarRespuestas() {
    const conf = invitados.filter(i => i.estado === "confirmado");
    const pend = invitados.filter(i => i.estado === "pendiente");
    const dec = invitados.filter(i => i.estado === "declinado");
    const personas = conf.reduce((s, i) => s + (i.asistentes || i.pases), 0);
    main.innerHTML = `<div class="vista">
      ${cabecera("RESPUESTAS", "Quién confirmó", `${conf.length} de ${invitados.length} invitaciones confirmadas.`)}
      <div class="stats"><div class="stat ok"><b>${personas}</b><span>personas confirmadas</span></div><div class="stat"><b>${pend.length}</b><span>sin responder</span></div><div class="stat"><b>${dec.length}</b><span>no asisten</span></div></div>
      <section class="sec"><div class="barra-res">${buscador("q-res")}<div class="filtros chips">${[["todos", `Todos (${invitados.length})`], ["conf", `Confirmados (${conf.length})`], ["pend", `Pendientes (${pend.length})`], ["dec", `No asisten (${dec.length})`]].map(([k, t]) => `<button data-filtro="${k}" class="${filtro === k ? "on" : ""}">${t}</button>`).join("")}</div>
        <div class="acts"><button class="btn chico sec" data-refresh>Actualizar</button><button class="btn chico" data-csv ${invitados.length ? "" : "disabled"}>Descargar lista</button></div></div>
        <div class="lista" id="lista-res">${filasResHTML()}</div>
      </section>
      ${pie()}
    </div>`;
  }

  function filasResHTML() {
    const l = invitados.filter(i => pasaFiltro(i, filtro) && coincide(i))
      .sort((a, b) => (b.respondido ? new Date(b.respondido) : 0) - (a.respondido ? new Date(a.respondido) : 0));
    return l.length ? l.map(i => `<div class="ti"><div class="top"><div><div class="nom">${esc(i.nombre)}</div><div class="meta">${detalleEstado(i)}</div></div><span class="badge ${i.estado}">${estadoTxt[i.estado]}</span></div><div class="acts"><button class="lnk mal" data-del="${i.codigo}">Eliminar</button></div></div>`).join("") : (invitados.length ? vacioBusqueda().replace("ninguna invitación", "ningún invitado") : `<div class="vacio">Cuando crees invitaciones, aquí verás quién confirma.</div>`);
  }

  function descargarCSV() {
    const filas = [["Nombre", "Estado", "Personas invitadas", "Personas que asisten", "Respondió", "Enlace"]];
    invitados.forEach(i => filas.push([i.nombre, estadoTxt[i.estado], i.pases, i.estado === "confirmado" ? (i.asistentes || i.pases) : "", i.respondido ? new Date(i.respondido).toLocaleString("es-CO") : "", enlace(i.codigo)]));
    const csv = "﻿" + filas.map(f => f.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "invitados-boda.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  // ---------- pintar según pestaña ----------
  function pintar() {
    $$(".bnav button", root).forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-current", on ? "page" : "false"); });
    $("#n-inv").textContent = invitados.length || ""; $("#n-inv").style.display = invitados.length ? "" : "none";
    const nc = invitados.filter(i => i.estado === "confirmado").length;
    $("#n-res").textContent = nc || ""; $("#n-res").style.display = nc ? "" : "none";
    ({ datos: pintarDatos, inv: pintarInvitaciones, res: pintarRespuestas })[tab]();
    actualizarEstado();
    clearInterval(refreshTimer);
    if (tab === "res") refreshTimer = setInterval(() => recargar(true), 30000);
  }
  async function recargar(silencio) {
    try { const d = await rpc("boda_admin_get", { p_key: key }); invitados = d.invitados || []; if (tab !== "datos") pintar(); if (!silencio) toast("Lista actualizada"); }
    catch { if (!silencio) toast("No se pudo actualizar", true); }
  }
  const irTab = t => { if (t === tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; } audio.pause(); tab = t; busqueda = ""; filtroInv = "todos"; window.scrollTo(0, 0); if (t !== "datos") recargar(true); pintar(); };

  // ---------- subida de archivos ----------
  async function subir(inp) {
    const k = inp.dataset.up, files = [...inp.files];
    if (!files.length) return;
    toast("Subiendo…");
    try {
      if (k === "fotos.final") {
        cfg.fotos.final = cfg.fotos.final.filter(u => !esEjemplo(u)); // las de ejemplo se reemplazan por las tuyas
        for (const f of files.slice(0, MAX_FINAL - cfg.fotos.final.length)) cfg.fotos.final.push(await subirArchivo(await comprimirImagen(f), eventoId, "jpg"));
      } else if (k === "cancion") {
        const f = files[0];
        if (f.size > 8 * 1024 * 1024) throw new Error("La canción pesa más de 8 MB");
        cfg.cancion = await subirArchivo(f, eventoId, /m4a|mp4/i.test(f.type + f.name) ? "m4a" : "mp3");
        cfg.cancionNombre = f.name.replace(/\.[^.]+$/, "").slice(0, 80);
        menuCancion = false;
      } else {
        setPath(cfg, k, await subirArchivo(await comprimirImagen(files[0], k === "portada" ? 1800 : 1200), eventoId, "jpg"));
      }
      marcarCambio(); toast("Listo"); repintarDatos();
    } catch (e) { toast("No se pudo subir: " + (e.message || "error"), true); inp.value = ""; }
  }

  // ---------- vista previa: la invitación real, tal como la ve el invitado ----------
  function vistaPrevia() {
    const w = document.createElement("div");
    w.className = "prev-wrap";
    w.innerHTML = `<div class="prev-bar"><span>Vista previa · así la verá tu invitado</span><button>Cerrar</button></div><div class="prev-inv"></div>`;
    document.body.appendChild(w);
    audio.pause();
    const quitarIntro = renderInvitacion($(".prev-inv", w), clonar(cfg), { nombre: "Nombre del invitado & Familia", pases: 4, estado: "pendiente" }, { preview: true });
    const cerrar = () => {
      w.querySelectorAll("audio").forEach(a => a.pause());
      if (quitarIntro) quitarIntro();
      w.classList.add("cierra"); setTimeout(() => w.remove(), 260);
    };
    $("button", w).onclick = cerrar;
  }

  // ---------- eventos ----------
  const cerrarMenus = () => { $("#menu").classList.remove("on"); if (menuCancion) { menuCancion = false; $("#songmenu")?.classList.remove("on"); } $$(".sel.abierto", root).forEach(s => { s.classList.remove("abierto"); $(".sel-b", s).setAttribute("aria-expanded", "false"); }); };

  root.addEventListener("click", async e => {
    // selectores de tipografía
    const selB = e.target.closest(".sel-b");
    if (selB) { const s = selB.parentElement, ab = s.classList.contains("abierto"); cerrarMenus(); if (!ab) { s.classList.add("abierto"); selB.setAttribute("aria-expanded", "true"); } return; }
    const opt = e.target.closest(".sel-l li");
    if (opt) {
      const s = opt.closest(".sel"), campo = s.dataset.sel, mapa = campo === "tipoPrincipal" ? FUENTES_PRINCIPAL : FUENTES_SECUNDARIA, v = mapa[opt.dataset.val];
      cfg[campo] = opt.dataset.val; marcarCambio();
      $(".sel-b .aa", s).style.fontFamily = v.css; $(".sel-n", s).textContent = v.n;
      $$("li", s).forEach(li => { const on = li === opt; li.classList.toggle("on", on); li.setAttribute("aria-selected", on); const ck = $("svg", li); if (ck) ck.remove(); if (on) li.insertAdjacentHTML("beforeend", I.check); });
      cerrarMenus(); return;
    }
    // menú del encabezado
    if (e.target.closest("#b-menu")) { const m = $("#menu"), ab = m.classList.contains("on"); cerrarMenus(); if (!ab) m.classList.add("on"); return; }
    const mi = e.target.closest("#menu [data-m]");
    if (mi) {
      cerrarMenus();
      if (mi.dataset.m === "copiar") return copiar(location.href);
      if (mi.dataset.m === "csv") return invitados.length ? descargarCSV() : toast("Aún no hay invitados para descargar");
      if (mi.dataset.m === "descartar") {
        if (!dirty) return toast("No hay cambios sin guardar");
        const r = await dialogo("¿Descartar los cambios?", `<p class="dlg-p">Se perderá lo que no hayas guardado y volverás a la última versión guardada.</p>`, [{ t: "No", cls: "sec" }, { t: "Sí, descartar", cls: "pri" }]);
        if (r.i !== 1) return;
        try { const d = await rpc("boda_admin_get", { p_key: key }); cfg = mezclar(DEFAULT_CONFIG, d.config || {}); dirty = false; try { localStorage.removeItem(draftKey); } catch {} pintar(); toast("Cambios descartados"); }
        catch { toast("No se pudo restaurar", true); }
        return;
      }
    }

    // canciones
    const songRow = e.target.closest(".song[data-song]");
    if (songRow && !e.target.closest("[data-play]")) { cfg.cancion = songRow.dataset.song; if (!cfg.cancion || CANCIONES.some(c => c.url === cfg.cancion)) cfg.cancionNombre = ""; marcarCambio(); return repintarDatos(); }
    const playB = e.target.closest("[data-play]");
    if (playB) return reproducir(playB.dataset.play);
    if (e.target.closest("[data-songmenu]")) { menuCancion = !menuCancion; $("#songmenu")?.classList.toggle("on", menuCancion); return; }
    const act = e.target.closest("[data-act]");
    if (act) {
      menuCancion = false;
      if (act.dataset.act === "cambiar") { listaCanciones = true; repintarDatos(); return $("#sec-musica .songlist")?.scrollIntoView({ block: "center", behavior: "smooth" }); }
      if (act.dataset.act === "lista") { listaCanciones = !listaCanciones; return repintarDatos(); }
      if (act.dataset.act === "quitar") { audio.pause(); cfg.cancion = ""; cfg.cancionNombre = ""; marcarCambio(); return repintarDatos(); }
    }

    const t = e.target.closest("button, a, label");
    if (!t) return;
    const d = t.dataset;
    if (d.tab) return irTab(d.tab);
    if (d.gotab) return irTab(d.gotab);
    if (t.id === "b-prev" || d.preview !== undefined) return vistaPrevia();
    if (d.save !== undefined) return guardar();
    if (d.rec !== undefined) { cfg = mezclar(DEFAULT_CONFIG, borrador.cfg); borrador = null; dirty = true; return pintar(); }
    if (d.desc !== undefined) { try { localStorage.removeItem(draftKey); } catch {} borrador = null; return pintarDatos(); }
    if (d.color) { cfg.color = d.color; marcarCambio(); return repintarDatos(); }
    if (d.tipo) { cfg.vestimenta.tipo = d.tipo; marcarCambio(); return repintarDatos(); }
    if (d.vc) { const a = cfg.vestimenta.colores, i = a.indexOf(d.vc); i < 0 ? a.push(d.vc) : a.splice(i, 1); marcarCambio(); return repintarDatos(); }
    if (d.addIt !== undefined) { cfg.itinerario.push({ t: "", h: "", ic: "estrella", mapa: "" }); marcarCambio(); repintarDatos(); const ins = $$(".it input[type=text]"); return ins[ins.length - 1]?.focus(); }
    if (d.rmIt !== undefined) { cfg.itinerario.splice(+d.rmIt, 1); mapaAbierto.clear(); marcarCambio(); return repintarDatos(); }
    if (d.itMapa !== undefined) { mapaAbierto.add(+d.itMapa); repintarDatos(); return $(`[data-k="itinerario.${d.itMapa}.mapa"]`)?.focus(); }
    if (d.rm) { setPath(cfg, d.rm, ""); marcarCambio(); return repintarDatos(); }
    if (d.rmF !== undefined) { cfg.fotos.final.splice(+d.rmF, 1); marcarCambio(); return repintarDatos(); }
    if (d.copy) return copiar(enlace(d.copy));
    if (d.filtro) { filtro = d.filtro; return pintarRespuestas(); }
    if (d.finv) { filtroInv = d.finv; $("#chips-inv").innerHTML = chipsInv(); $("#lista-inv").innerHTML = listaInvHTML(); return; }
    if (d.limpiar !== undefined) {
      busqueda = ""; const inp = $(".buscar input"); inp.value = ""; t.hidden = true; inp.focus();
      if (inp.id === "q-inv") $("#lista-inv").innerHTML = listaInvHTML(); else $("#lista-res").innerHTML = filasResHTML();
      return;
    }
    if (d.refresh !== undefined) return recargar(false);
    if (d.csv !== undefined) return descargarCSV();
    if (t.id === "p-menos") { nuevoPases = Math.max(1, nuevoPases - 1); $("#p-n").textContent = nuevoPases; return; }
    if (t.id === "p-mas") { nuevoPases = Math.min(30, nuevoPases + 1); $("#p-n").textContent = nuevoPases; return; }
    if (t.id === "gen") return crear([{ nombre: $("#in-nombre").value, pases: nuevoPases }], true);
    if (t.id === "gen-lote") {
      const items = $("#in-lote").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
        const m = /^(.*?)[,;]\s*(\d{1,2})$/.exec(l);
        return m ? { nombre: m[1].trim(), pases: +m[2] } : { nombre: l, pases: 1 };
      });
      return crear(items, false);
    }
    if (d.edit) {
      const i = invitados.find(x => x.codigo === d.edit);
      const r = await dialogo("Editar invitación", `<label class="f"><span>Nombre</span><input name="nombre" type="text" value="${esc(i.nombre)}" maxlength="120"></label><label class="f"><span>Personas</span><input name="pases" type="number" min="1" max="30" value="${i.pases}"></label>`, [{ t: "Cancelar", cls: "sec" }, { t: "Guardar", cls: "pri" }]);
      if (r.i !== 1 || !r.vals.nombre.trim()) return;
      try { await rpc("boda_admin_editar", { p_key: key, p_codigo: i.codigo, p_nombre: r.vals.nombre, p_pases: Math.max(1, Math.min(30, +r.vals.pases || 1)) }); await recargar(true); pintar(); toast("Cambios guardados"); }
      catch { toast("No se pudo guardar el cambio", true); }
      return;
    }
    if (d.del) {
      const i = invitados.find(x => x.codigo === d.del);
      const r = await dialogo("¿Eliminar esta invitación?", `<p class="dlg-p">Se borrará la invitación de <b>${esc(i.nombre)}</b> y su enlace dejará de funcionar${i.estado === "confirmado" ? `. Ya había <b>confirmado</b> su asistencia: esa respuesta también se elimina y dejará de contarse` : i.estado === "declinado" ? ", junto con su respuesta" : ""}.</p>`, [{ t: "No", cls: "sec" }, { t: "Sí, eliminar", cls: "pri" }]);
      if (r.i !== 1) return;
      try { await rpc("boda_admin_borrar", { p_key: key, p_codigo: i.codigo }); await recargar(true); pintar(); toast("Invitación eliminada"); }
      catch { toast("No se pudo eliminar", true); }
    }
  });

  async function crear(items, uno) {
    const validos = items.filter(i => i.nombre && i.nombre.trim());
    if (!validos.length) { toast("Escribe el nombre del invitado", true); $("#in-nombre")?.focus(); return; }
    const btn = $(uno ? "#gen" : "#gen-lote"); btn.disabled = true;
    try {
      const out = await rpc("boda_admin_crear", { p_key: key, p_items: validos });
      await recargar(true);
      resultadoNuevo = uno ? out[0] : null; nuevoPases = 1; busqueda = ""; filtroInv = "todos";
      pintar();
      toast(uno ? "Invitación generada" : `${out.length} invitaciones generadas`);
    } catch { toast("No se pudo crear. Inténtalo de nuevo.", true); btn.disabled = false; }
  }

  root.addEventListener("input", e => {
    if (e.target.id === "q-inv" || e.target.id === "q-res") {
      busqueda = e.target.value;
      const x = $(".b-x", e.target.parentElement); if (x) x.hidden = !busqueda;
      if (e.target.id === "q-inv") $("#lista-inv").innerHTML = listaInvHTML(); else $("#lista-res").innerHTML = filasResHTML();
      return;
    }
    const k = e.target.dataset.k;
    if (!k) return;
    setPath(cfg, k, e.target.type === "checkbox" ? e.target.checked : e.target.value);
    // fecha: muestra el texto legible en lugar del formato del navegador
    if (e.target.type === "date") { const tx = e.target.parentElement.querySelector(".fecha-txt"); const v = e.target.value; tx.textContent = v ? fechaLeible(v) : "Elegir fecha"; tx.classList.toggle("ph", !v); }
    if (k === "novio" || k === "novia") titularNombres();
    marcarCambio();
    if (e.target.dataset.re) repintarDatos();
  });
  root.addEventListener("change", e => { if (e.target.dataset.up) subir(e.target); });
  // La fecha abre el calendario del dispositivo al tocar cualquier parte del campo
  root.addEventListener("click", e => { const f = e.target.closest(".fecha-f"); if (f) { const i = $("input", f); try { i.showPicker && i.showPicker(); } catch {} } });
  root.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.id === "in-nombre") $("#gen").click();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".song[data-song]")) { e.preventDefault(); e.target.click(); }
    if (e.key === "Escape") cerrarMenus();
  });
  document.addEventListener("click", e => { if (!e.target.closest(".sel, .menu, .kebab, #b-menu")) cerrarMenus(); });

  pintar();
}
