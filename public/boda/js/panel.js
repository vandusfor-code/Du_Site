// Panel de administración: asistente de datos, generador de invitaciones y lista de respuestas.
import { rpc, subirArchivo, comprimirImagen } from "./api.js";
import { esc, DEFAULT_CONFIG, mezclar, clonar, getPath, setPath, PALETAS, COLORES_VEST, TIPOS_VEST, ICONOS, fmtFechaLarga, urlSegura } from "./util.js";
import { renderInvitacion } from "./invitacion.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const PASOS = [
  { id: "novios",    t: "Los novios" },
  { id: "fotos",     t: "Fotos" },
  { id: "mensaje",   t: "Mensaje y música" },
  { id: "ceremonia", t: "Ceremonia" },
  { id: "recepcion", t: "Recepción" },
  { id: "detalles",  t: "Detalles del día" },
  { id: "revisar",   t: "Revisar y guardar" }
];

const IC = (n, p) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

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
  let tab = "datos", paso = 0, dirty = false, saving = false, guardadoAlgunaVez = !!(data.config && data.config.novio);
  let resultadoNuevo = null, filtro = "todos", refreshTimer = null;

  const base = location.origin + location.pathname.replace(/index\.html$/, "");
  const enlace = c => `${base}?i=${c}`;

  root.innerHTML = `<div class="adm">
    <header class="adm-top"><div class="marca">Tu invitación</div>
      <div class="acc"><button class="btn chico sec" id="b-prev">${IC(15, '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')} Vista previa</button>
      <button class="btn chico pri" id="b-save">Guardado</button></div></header>
    <nav class="adm-tabs"><button data-tab="datos">Mi invitación</button><button data-tab="inv">Invitaciones <span class="n" id="n-inv"></span></button><button data-tab="res">Respuestas <span class="n" id="n-res"></span></button></nav>
    <main id="main"></main></div><div id="toast"></div>`;
  const main = $("#main", root);

  // ---------- utilidades de interfaz ----------
  let toastT;
  const toast = (m, err) => { const t = $("#toast"); t.textContent = m; t.className = "on" + (err ? " err" : ""); clearTimeout(toastT); toastT = setTimeout(() => (t.className = ""), 3200); };

  const dialogo = (titulo, cuerpo, botones) => new Promise(res => {
    const d = document.createElement("div");
    d.className = "dlg";
    d.innerHTML = `<div class="dlg-c"><h3>${titulo}</h3>${cuerpo}<div class="dlg-b">${botones.map((b, i) => `<button class="btn ${b.cls || ""}" data-i="${i}">${b.t}</button>`).join("")}</div></div>`;
    document.body.appendChild(d);
    const fin = i => { const vals = {}; $$("[name]", d).forEach(x => (vals[x.name] = x.value)); d.remove(); res({ i, vals }); };
    $$("[data-i]", d).forEach(b => (b.onclick = () => fin(+b.dataset.i)));
    d.addEventListener("click", e => { if (e.target === d) fin(-1); });
    const first = $("input", d); if (first) first.focus();
  });

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); }
    catch { const t = document.createElement("textarea"); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    toast("Enlace copiado");
  }

  const nombreCorto = () => [cfg.novio, cfg.novia].filter(Boolean).join(" y ") || "los novios";
  const mensajeWA = nombre => `Hola ${nombre} 💌 ¡${nombreCorto()} te invitan a su boda! Abre tu invitación personal aquí:`;

  // ---------- estado guardado / borrador ----------
  function actualizarGuardar() {
    const b = $("#b-save");
    b.disabled = !dirty && !saving;
    b.className = "btn chico " + (dirty ? "pri" : "sec");
    b.innerHTML = saving ? `<span class="spin"></span> Guardando…` : dirty ? "Guardar cambios" : `${IC(15, '<path d="M5 12.500l4.500 4.500L19 7.500"/>')} Guardado`;
  }
  function marcarCambio() {
    dirty = true; actualizarGuardar();
    try { localStorage.setItem(draftKey, JSON.stringify({ cfg, dirty: true })); } catch {}
  }
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  async function guardar() {
    if (saving) return;
    cfg.novio = cfg.novio.trim(); cfg.novia = cfg.novia.trim();
    saving = true; actualizarGuardar();
    try {
      await rpc("boda_admin_guardar", { p_key: key, p_config: cfg });
      dirty = false; guardadoAlgunaVez = true;
      try { localStorage.removeItem(draftKey); } catch {}
      toast("¡Guardado! Tu invitación está lista");
    } catch (e) { toast("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.", true); }
    saving = false; actualizarGuardar();
    if (tab === "datos" && PASOS[paso].id === "revisar") pintar();
  }

  // ---------- campos ----------
  const F = (label, k, o = {}) => {
    const v = getPath(cfg, k) ?? "";
    const campo = o.type === "textarea"
      ? `<textarea data-k="${k}" rows="${o.rows || 4}" placeholder="${esc(o.ph || "")}">${esc(v)}</textarea>`
      : `<input data-k="${k}" type="${o.type || "text"}" value="${esc(v)}" placeholder="${esc(o.ph || "")}" ${o.type === "url" ? 'inputmode="url" autocapitalize="off"' : ""}>`;
    return `<label class="f"><span>${label}</span>${campo}${o.hint ? `<small>${o.hint}</small>` : ""}</label>`;
  };

  const foto1 = (k, label, o = {}) => {
    const u = getPath(cfg, k);
    return `<div class="f"><span>${label}</span><div class="up">
      <div class="up-prev">${u ? `<img src="${esc(u)}" alt="">` : "Sin foto"}</div>
      <div class="up-btns"><label class="btn sec chico">${u ? "Cambiar foto" : "Elegir foto"}<input type="file" accept="image/*" hidden data-up="${k}"></label>
      ${u ? `<button type="button" class="lnk mal" data-rm="${k}">Quitar</button>` : ""}</div></div>${o.hint ? `<small style="color:var(--sub);font-size:.8rem">${o.hint}</small>` : ""}</div>`;
  };

  // ---------- pasos del asistente ----------
  const VISTAS = {
    novios: () => `<h2>Cuéntanos de los novios</h2><p class="sub">Solo lo básico. Todo se puede cambiar después.</p>
      <div class="fila">${F("Nombre del novio", "novio", { ph: "Ej: Duvan" })}${F("Nombre de la novia", "novia", { ph: "Ej: Daniela" })}</div>
      ${F("Fecha de la boda", "fecha", { type: "date" })}
      <div class="f"><span>Color principal de la invitación</span><div class="sw">${Object.entries(PALETAS).map(([k, v]) => `<button type="button" data-color="${k}" class="${cfg.color === k ? "on" : ""}" style="background:${v.c}" title="${v.n}" aria-label="${v.n}"></button>`).join("")}</div></div>`,

    fotos: () => `<h2>Las fotos</h2><p class="sub">Sube la que más les guste para la portada y de 4 a 8 fotos más. Se acomodan solas en la invitación.</p>
      ${foto1("portada", "Foto de portada", { hint: "Funciona mejor una foto vertical." })}
      <div class="f" style="margin-top:20px"><span>Más fotos (${cfg.galeria.length}/8)</span>
        <div class="grid-fotos">${cfg.galeria.map((u, i) => `<div class="t"><img src="${esc(u)}" alt=""><button type="button" data-rm-g="${i}" aria-label="Quitar foto">×</button></div>`).join("")}
        ${cfg.galeria.length < 8 ? `<label class="mas">+ Agregar<input type="file" accept="image/*" multiple hidden data-up="galeria"></label>` : ""}</div></div>`,

    mensaje: () => `<h2>Mensaje y música</h2><p class="sub">Ya dejamos un texto de ejemplo; cámbialo por el de ustedes.</p>
      ${F("Versículo o frase", "versiculo", { type: "textarea", rows: 3 })}
      ${F("Cita del versículo", "cita", { ph: "Ej: 1 Corintios 13:13" })}
      ${F("Mensaje de los novios", "mensaje", { type: "textarea", rows: 6, hint: "Deja una línea en blanco para separar párrafos." })}
      <div class="f"><span>Canción (opcional)</span>${cfg.cancion
        ? `<div class="audio-ok"><audio controls src="${esc(cfg.cancion)}"></audio><button type="button" class="lnk mal" data-rm="cancion">Quitar</button></div>`
        : `<label class="btn sec chico">Subir canción (MP3)<input type="file" accept="audio/mpeg,audio/mp4,.mp3,.m4a" hidden data-up="cancion"></label><small>Máximo 8 MB. Se reproduce cuando el invitado toca el botón.</small>`}</div>`,

    ceremonia: () => `<h2>La ceremonia</h2><p class="sub">¿Dónde y a qué hora se celebra?</p>
      ${F("Nombre del lugar", "ceremonia.nombre", { ph: "Ej: Iglesia Nuestra Señora de…" })}
      ${F("Hora", "ceremonia.hora", { type: "time" })}
      ${F("Dirección", "ceremonia.dir", { ph: "Calle, barrio, ciudad" })}
      ${F("Enlace de Google Maps", "ceremonia.mapa", { type: "url", ph: "https://maps.app.goo.gl/…", hint: "En Google Maps busca el lugar → Compartir → Copiar enlace, y pégalo aquí." })}
      ${foto1("ceremonia.foto", "Foto del lugar (opcional)")}`,

    recepcion: () => `<h2>La recepción</h2><p class="sub">¿Se celebra en otro lugar?</p>
      <label class="chk"><input type="checkbox" data-k="recepcion.mismo" data-re="1" ${cfg.recepcion.mismo ? "checked" : ""}><span><b>Es en el mismo lugar de la ceremonia</b><small>Mostraremos un solo lugar en la invitación.</small></span></label>
      ${cfg.recepcion.mismo ? "" : `
      ${F("Nombre del lugar", "recepcion.nombre", { ph: "Ej: Salón Las Marías" })}
      ${F("Hora", "recepcion.hora", { type: "time" })}
      ${F("Dirección", "recepcion.dir", { ph: "Calle, barrio, ciudad" })}
      ${F("Enlace de Google Maps", "recepcion.mapa", { type: "url", ph: "https://maps.app.goo.gl/…" })}
      ${foto1("recepcion.foto", "Foto del lugar (opcional)")}`}`,

    detalles: () => `<h2>Detalles del día</h2><p class="sub">Vestimenta, programa y confirmación.</p>
      <div class="f"><span>Código de vestimenta</span><div class="chips">${TIPOS_VEST.map(t => `<button type="button" data-tipo="${esc(t)}" class="${cfg.vestimenta.tipo === t ? "on" : ""}">${t}</button>`).join("")}</div></div>
      <div class="f"><span>Colores que prefieren evitar</span><div class="sw vest">${COLORES_VEST.map(c => `<button type="button" data-vc="${c.c}" class="${cfg.vestimenta.colores.includes(c.c) ? "on" : ""}" style="background:${c.c}" title="${c.n}" aria-label="${c.n}"></button>`).join("")}</div><small>Toca los colores para marcarlos; escribimos la frase por ti.</small></div>
      ${F("Nota adicional de vestimenta (opcional)", "vestimenta.nota", { ph: "Ej: Traer abrigo, será al aire libre" })}
      <div class="f"><span>Programa del día</span>
        ${cfg.itinerario.map((x, i) => `<div class="it">
          <select data-k="itinerario.${i}.ic" aria-label="Icono">${Object.entries(ICONOS).map(([k, v]) => `<option value="${k}" ${x.ic === k ? "selected" : ""}>${v.n}</option>`).join("")}</select>
          <input type="text" data-k="itinerario.${i}.t" value="${esc(x.t)}" placeholder="Ej: Cena">
          <input type="time" data-k="itinerario.${i}.h" value="${esc(x.h)}" aria-label="Hora">
          <button type="button" class="x" data-rm-it="${i}" aria-label="Quitar">×</button></div>`).join("")}
        <button type="button" class="btn chico sec" data-add-it>+ Agregar momento</button>
        <small>Pon la hora de cada momento; si la dejas vacía solo se muestra el nombre.</small></div>
      <label class="chk"><input type="checkbox" data-k="sobres.activo" data-re="1" ${cfg.sobres.activo ? "checked" : ""}><span><b>Incluir “lluvia de sobres”</b><small>Un mensaje para quienes quieran hacer un regalo en efectivo.</small></span></label>
      ${cfg.sobres.activo ? F("Texto de la lluvia de sobres", "sobres.texto", { type: "textarea", rows: 3 }) : ""}
      ${F("Confirmar asistencia antes del", "confirmarAntes", { type: "date" })}`,

    revisar: () => {
      const c = cfg, r = [];
      r.push([!!(c.novio && c.novia), "Nombres de los novios", 0]);
      r.push([!!c.fecha, "Fecha de la boda", 0]);
      r.push([!!c.portada, "Foto de portada", 1]);
      r.push([c.galeria.length >= 1, `Fotos adicionales (${c.galeria.length})`, 1]);
      r.push([!!(c.ceremonia.nombre && c.ceremonia.hora), "Lugar y hora de la ceremonia", 3]);
      r.push([!!urlSegura(c.ceremonia.mapa), "Enlace de Google Maps de la ceremonia", 3]);
      r.push([c.recepcion.mismo || !!(c.recepcion.nombre && c.recepcion.hora), "Lugar y hora de la recepción", 4]);
      r.push([!!c.confirmarAntes, "Fecha límite para confirmar", 5]);
      const faltan = r.filter(x => !x[0]).length;
      return `<h2>Todo listo para guardar</h2><p class="sub">${faltan ? `Faltan ${faltan} dato${faltan > 1 ? "s" : ""}. Puedes guardar igual y completarlos después.` : "¡Está todo completo!"}</p>
        <ul class="rev-lista">${r.map(([ok, t, p]) => `<li><span class="p ${ok ? "ok" : "falta"}">${ok ? "✓" : "!"}</span>${t}${ok ? "" : `<button class="lnk" data-go="${p}">Completar</button>`}</li>`).join("")}</ul>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn pri" data-save style="flex:1;min-width:180px;padding:13px">${dirty ? "Guardar mi invitación" : "Guardado ✓"}</button><button class="btn" data-prev>Ver vista previa</button></div>
        ${guardadoAlgunaVez && !dirty ? `<div class="resultado" style="margin-top:18px"><b>¡Tu invitación está guardada!</b><div style="margin:6px 0 12px;font-size:.92rem">Ahora crea las invitaciones personalizadas para cada invitado.</div><button class="btn pri" data-gotab="inv">Crear invitaciones →</button></div>` : ""}`;
    }
  };

  function pintarDatos() {
    const p = PASOS[paso];
    main.innerHTML = `
      ${borrador ? `<div class="aviso">Tienes cambios sin guardar de tu última visita. <button class="btn chico" data-rec>Recuperar</button><button class="lnk" data-desc>Descartar</button></div>` : ""}
      <div class="card">
        <div class="pasos">${PASOS.map((_, i) => `<i class="${i < paso ? "hecho" : i === paso ? "actual" : ""}"></i>`).join("")}</div>
        <div class="paso-info"><span>Paso ${paso + 1} de ${PASOS.length}</span><span>${p.t}</span></div>
        <div id="paso">${VISTAS[p.id]()}</div>
        ${p.id === "revisar" ? "" : `<div class="nav"><button class="btn sec" data-prev-paso ${paso === 0 ? "disabled" : ""}>← Atrás</button><button class="btn pri" data-next-paso>Siguiente →</button></div>`}
        ${p.id === "revisar" ? `<div class="nav"><button class="btn sec" data-prev-paso>← Atrás</button><span></span></div>` : ""}
      </div>`;
  }

  // ---------- pestaña: invitaciones ----------
  let nuevoPases = 1;
  function pintarInvitaciones() {
    const listo = cfg.novio && cfg.novia && guardadoAlgunaVez;
    main.innerHTML = `
      ${listo ? "" : `<div class="aviso">Primero completa y guarda los datos de tu invitación. <button class="btn chico" data-gotab="datos">Ir a mi invitación</button></div>`}
      <div class="card"><h2>Nueva invitación</h2><p class="sub">Escribe a quién invitas. Se crea un enlace único y, cuando esa persona confirme, sabrás exactamente quién fue.</p>
        <div class="nuevo">
          <label class="f" style="margin:0"><span>Nombre del invitado o familia</span><input id="in-nombre" type="text" placeholder="Ej: Duvan Ramos & Familia" maxlength="120"></label>
          <div><span style="display:block;font-weight:600;font-size:.92rem;margin-bottom:6px">Personas</span><div class="pases"><button type="button" id="p-menos" aria-label="Menos">−</button><b id="p-n">${nuevoPases}</b><button type="button" id="p-mas" aria-label="Más">+</button></div></div>
        </div>
        <div style="margin-top:14px"><button class="btn pri" id="gen">Generar invitación</button></div>
        <div id="resultado">${resultadoNuevo ? htmlResultado(resultadoNuevo) : ""}</div>
        <details><summary>Agregar varias a la vez</summary>
          <label class="f" style="margin-top:10px"><textarea id="in-lote" rows="5" placeholder="Una por línea. Si quieres, agrega las personas después de una coma:&#10;Duvan Ramos & Familia, 4&#10;María López, 1"></textarea></label>
          <button class="btn" id="gen-lote">Generar todas</button></details>
      </div>
      <h2 style="margin:24px 4px 4px">Tus invitaciones (${invitados.length})</h2>
      <div class="lista">${invitados.length ? invitados.map(tarjeta).join("") : `<div class="vacio">Aún no has creado ninguna invitación.</div>`}</div>`;
  }
  const htmlResultado = r => `<div class="resultado"><b>¡Invitación lista para ${esc(r.nombre)}!</b><div class="link">${esc(enlace(r.codigo))}</div>
    <div class="row"><button class="btn pri chico" data-copy="${r.codigo}">Copiar enlace</button><a class="btn chico" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensajeWA(r.nombre) + " " + enlace(r.codigo))}">Enviar por WhatsApp</a><a class="btn chico sec" target="_blank" rel="noopener" href="${esc(enlace(r.codigo))}">Abrir</a></div></div>`;

  const estadoTxt = { confirmado: "Confirmó", pendiente: "Pendiente", declinado: "No asiste" };
  const fechaCorta = s => s ? new Date(s).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  const tarjeta = i => `<div class="ti"><div class="top"><div><div class="nom">${esc(i.nombre)}</div>
      <div class="meta">${i.pases} ${i.pases === 1 ? "persona" : "personas"}${i.visto && i.estado === "pendiente" ? " · ya la abrió" : ""}${!i.visto ? " · aún no la abre" : ""}</div></div><span class="badge ${i.estado}">${estadoTxt[i.estado]}</span></div>
      <div class="acts"><button class="btn chico" data-copy="${i.codigo}">Copiar enlace</button>
      <a class="btn chico" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensajeWA(i.nombre) + " " + enlace(i.codigo))}">WhatsApp</a>
      <button class="lnk" data-edit="${i.codigo}">Editar</button><button class="lnk mal" data-del="${i.codigo}">Eliminar</button></div></div>`;

  // ---------- pestaña: respuestas ----------
  function pintarRespuestas() {
    const conf = invitados.filter(i => i.estado === "confirmado");
    const pend = invitados.filter(i => i.estado === "pendiente");
    const dec = invitados.filter(i => i.estado === "declinado");
    const personas = conf.reduce((s, i) => s + (i.asistentes || i.pases), 0);
    const lista = filtro === "todos" ? invitados : invitados.filter(i => i.estado === ({ conf: "confirmado", pend: "pendiente", dec: "declinado" })[filtro]);
    const ordenada = [...lista].sort((a, b) => (b.respondido ? new Date(b.respondido) : 0) - (a.respondido ? new Date(a.respondido) : 0));
    main.innerHTML = `
      <div class="stats"><div class="stat ok"><b>${personas}</b><span>personas confirmadas</span></div><div class="stat"><b>${pend.length}</b><span>sin responder</span></div><div class="stat"><b>${dec.length}</b><span>no asisten</span></div></div>
      <div class="card"><div class="barra-res"><h2 style="margin:0">Respuestas</h2><div><button class="btn chico sec" data-refresh>Actualizar</button> <button class="btn chico" data-csv ${invitados.length ? "" : "disabled"}>Descargar lista</button></div></div>
        <p class="sub" style="margin-bottom:8px">${conf.length} de ${invitados.length} invitaciones confirmadas.</p>
        <div class="filtros chips">${[["todos", `Todos (${invitados.length})`], ["conf", `Confirmados (${conf.length})`], ["pend", `Pendientes (${pend.length})`], ["dec", `No asisten (${dec.length})`]].map(([k, t]) => `<button data-filtro="${k}" class="${filtro === k ? "on" : ""}">${t}</button>`).join("")}</div>
        <div class="lista">${ordenada.length ? ordenada.map(i => `<div class="ti"><div class="top"><div><div class="nom">${esc(i.nombre)}</div><div class="meta">${i.estado === "confirmado" ? `${i.asistentes || i.pases} ${(i.asistentes || i.pases) === 1 ? "persona" : "personas"} · ${fechaCorta(i.respondido)}` : i.estado === "declinado" ? fechaCorta(i.respondido) : `${i.pases} ${i.pases === 1 ? "persona" : "personas"}`}</div></div><span class="badge ${i.estado}">${estadoTxt[i.estado]}</span></div></div>`).join("") : `<div class="vacio">${invitados.length ? "No hay invitados en esta categoría." : "Cuando crees invitaciones, aquí verás quién confirma."}</div>`}</div>
      </div>`;
  }

  function descargarCSV() {
    const filas = [["Nombre", "Estado", "Personas invitadas", "Personas que asisten", "Respondió"]];
    invitados.forEach(i => filas.push([i.nombre, estadoTxt[i.estado], i.pases, i.estado === "confirmado" ? (i.asistentes || i.pases) : "", i.respondido ? new Date(i.respondido).toLocaleString("es-CO") : ""]));
    const csv = "﻿" + filas.map(f => f.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "invitados-boda.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  // ---------- pintar según pestaña ----------
  function pintar() {
    $$(".adm-tabs button", root).forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    $("#n-inv").textContent = invitados.length || ""; $("#n-inv").style.display = invitados.length ? "" : "none";
    const nc = invitados.filter(i => i.estado === "confirmado").length;
    $("#n-res").textContent = nc || ""; $("#n-res").style.display = nc ? "" : "none";
    ({ datos: pintarDatos, inv: pintarInvitaciones, res: pintarRespuestas })[tab]();
    actualizarGuardar();
    clearInterval(refreshTimer);
    if (tab === "res") refreshTimer = setInterval(() => recargar(true), 30000);
  }
  async function recargar(silencio) {
    try { const d = await rpc("boda_admin_get", { p_key: key }); invitados = d.invitados || []; if (tab !== "datos") pintar(); if (!silencio) toast("Lista actualizada"); }
    catch { if (!silencio) toast("No se pudo actualizar", true); }
  }
  const irTab = t => { tab = t; window.scrollTo(0, 0); if (t !== "datos") recargar(true); pintar(); };

  // ---------- subida de archivos ----------
  async function subir(inp) {
    const k = inp.dataset.up, files = [...inp.files];
    if (!files.length) return;
    toast("Subiendo…");
    try {
      if (k === "galeria") {
        for (const f of files.slice(0, 8 - cfg.galeria.length)) cfg.galeria.push(await subirArchivo(await comprimirImagen(f), eventoId, "jpg"));
      } else if (k === "cancion") {
        const f = files[0];
        if (f.size > 8 * 1024 * 1024) throw new Error("La canción pesa más de 8 MB");
        cfg.cancion = await subirArchivo(f, eventoId, /m4a|mp4/i.test(f.type + f.name) ? "m4a" : "mp3");
      } else {
        setPath(cfg, k, await subirArchivo(await comprimirImagen(files[0], k === "portada" ? 1800 : 1200), eventoId, "jpg"));
      }
      marcarCambio(); toast("Listo ✓"); pintar();
    } catch (e) { toast("No se pudo subir: " + (e.message || "error"), true); inp.value = ""; }
  }

  // ---------- vista previa ----------
  function vistaPrevia() {
    const w = document.createElement("div");
    w.className = "prev-wrap";
    w.innerHTML = `<div class="prev-bar"><span>Vista previa de tu invitación</span><button>Cerrar</button></div><div class="prev-inv"></div>`;
    document.body.appendChild(w);
    renderInvitacion($(".prev-inv", w), clonar(cfg), { nombre: "Nombre del invitado & Familia", pases: 4, estado: "pendiente" }, { preview: true });
    $("button", w).onclick = () => w.remove();
  }

  // ---------- eventos ----------
  root.addEventListener("click", async e => {
    const t = e.target.closest("button, a, label");
    if (!t) return;
    const d = t.dataset;
    if (d.tab) return irTab(d.tab);
    if (d.gotab) return irTab(d.gotab);
    if (t.id === "b-prev" || d.prev !== undefined) return vistaPrevia();
    if (t.id === "b-save" || d.save !== undefined) return guardar();
    if (d.nextPaso !== undefined) { paso = Math.min(PASOS.length - 1, paso + 1); window.scrollTo(0, 0); return pintarDatos(); }
    if (d.prevPaso !== undefined) { paso = Math.max(0, paso - 1); window.scrollTo(0, 0); return pintarDatos(); }
    if (d.go !== undefined) { paso = +d.go; window.scrollTo(0, 0); return pintarDatos(); }
    if (d.rec !== undefined) { cfg = mezclar(DEFAULT_CONFIG, borrador.cfg); borrador = null; dirty = true; return pintar(); }
    if (d.desc !== undefined) { try { localStorage.removeItem(draftKey); } catch {} borrador = null; return pintarDatos(); }
    if (d.color) { cfg.color = d.color; marcarCambio(); return pintarDatos(); }
    if (d.tipo) { cfg.vestimenta.tipo = d.tipo; marcarCambio(); return pintarDatos(); }
    if (d.vc) { const a = cfg.vestimenta.colores, i = a.indexOf(d.vc); i < 0 ? a.push(d.vc) : a.splice(i, 1); marcarCambio(); return pintarDatos(); }
    if (d.addIt !== undefined) { cfg.itinerario.push({ t: "", h: "", ic: "estrella" }); marcarCambio(); pintarDatos(); const ins = $$(".it input[type=text]"); return ins[ins.length - 1]?.focus(); }
    if (d.rmIt !== undefined) { cfg.itinerario.splice(+d.rmIt, 1); marcarCambio(); return pintarDatos(); }
    if (d.rm) { setPath(cfg, d.rm, ""); marcarCambio(); return pintarDatos(); }
    if (d.rmG !== undefined) { cfg.galeria.splice(+d.rmG, 1); marcarCambio(); return pintarDatos(); }
    if (d.copy) return copiar(enlace(d.copy));
    if (d.filtro) { filtro = d.filtro; return pintarRespuestas(); }
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
      const r = await dialogo("¿Eliminar esta invitación?", `<p style="margin:0 0 4px;color:var(--sub)">Se borrará la invitación de <b>${esc(i.nombre)}</b> y su enlace dejará de funcionar${i.estado !== "pendiente" ? ", junto con su respuesta" : ""}.</p>`, [{ t: "No", cls: "sec" }, { t: "Sí, eliminar", cls: "pri" }]);
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
      resultadoNuevo = uno ? out[0] : null; nuevoPases = 1;
      pintar();
      toast(uno ? "¡Invitación generada!" : `${out.length} invitaciones generadas`);
    } catch { toast("No se pudo crear. Inténtalo de nuevo.", true); btn.disabled = false; }
  }

  root.addEventListener("input", e => {
    const k = e.target.dataset.k;
    if (!k) return;
    setPath(cfg, k, e.target.type === "checkbox" ? e.target.checked : e.target.value);
    marcarCambio();
    if (e.target.dataset.re) pintarDatos();
  });
  root.addEventListener("change", e => { if (e.target.dataset.up) subir(e.target); });
  root.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "in-nombre") $("#gen").click(); });

  if (borrador) { /* el aviso se muestra en la pestaña de datos */ }
  pintar();
}
