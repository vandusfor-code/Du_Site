// Enrutador: ?admin=CLAVE → panel · ?i=CODIGO → invitación personal
import { rpc } from "./api.js";
import { mezclar, DEFAULT_CONFIG, esc } from "./util.js";
import { renderInvitacion } from "./invitacion.js";
import { iniciarPanel } from "./panel.js";

const app = document.getElementById("app");
const q = new URLSearchParams(location.search);

const pantalla = (titulo, texto) => {
  app.className = "";
  app.innerHTML = `<div class="centro"><div><h1>${esc(titulo)}</h1><p>${esc(texto)}</p></div></div>`;
};

async function invitado(codigo) {
  app.innerHTML = `<div class="centro"><p>Cargando tu invitación…</p></div>`;
  let d;
  try { d = await rpc("boda_invitado_get", { p_codigo: codigo }); }
  catch (e) {
    if (e.code === "invitacion_no_encontrada") return pantalla("Invitación no encontrada", "Este enlace no es válido o la invitación fue eliminada. Pídele a los novios que te lo envíen de nuevo.");
    return pantalla("Sin conexión", "No pudimos cargar tu invitación. Revisa tu internet e inténtalo otra vez.");
  }
  const cfg = mezclar(DEFAULT_CONFIG, d.config || {});
  if (!cfg.novio && !cfg.novia) return pantalla("Muy pronto", "Los novios están preparando su invitación. Vuelve a abrir este enlace en unos días.");
  document.title = `${cfg.novio} & ${cfg.novia} · Invitación de boda`;
  renderInvitacion(app, cfg, d.invitado, { codigo });
}

if (q.get("admin")) {
  document.title = "Panel de la invitación";
  document.body.classList.add("modo-panel");
  iniciarPanel(app, q.get("admin"));
} else if (q.get("i")) {
  invitado(q.get("i"));
} else {
  pantalla("Invitación de boda", "Abre el enlace personal que te enviaron los novios para ver tu invitación.");
}
