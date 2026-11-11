// Instalación del panel como app + avisos al celular (notificaciones push).
// Todo es opcional: si el navegador no lo soporta, el panel funciona igual.
import { rpc } from "./api.js";

const SW_URL = new URL("../sw.js", import.meta.url);
const ALCANCE = new URL("../", import.meta.url);          // /boda/ en producción
const ICONO = n => new URL("../img/" + n, import.meta.url).href;

export const soportaSW = () => "serviceWorker" in navigator;
export const soportaPush = () => soportaSW() && "PushManager" in window && "Notification" in window;
export const esApp = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* ---------- instalar como app ---------- */
let promptInstalar = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInstalar = e; });

// Manifiesto propio de cada boda: la app abre directo el panel de esa pareja.
export function prepararApp(nombre) {
  const head = document.head;
  const poner = (tag, attrs) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); head.appendChild(el); };
  const man = {
    id: location.pathname, name: nombre, short_name: "Mi boda", description: "Invitados y respuestas de tu boda",
    start_url: location.href, scope: ALCANCE.href, display: "standalone", orientation: "portrait",
    background_color: "#FAF6F2", theme_color: "#7B2D3F", lang: "es",
    icons: [{ src: ICONO("app-192.png"), sizes: "192x192", type: "image/png", purpose: "any maskable" }, { src: ICONO("app-512.png"), sizes: "512x512", type: "image/png", purpose: "any maskable" }]
  };
  try { poner("link", { rel: "manifest", href: URL.createObjectURL(new Blob([JSON.stringify(man)], { type: "application/manifest+json" })) }); } catch {}
  poner("link", { rel: "apple-touch-icon", href: ICONO("app-180.png") });
  poner("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  poner("meta", { name: "mobile-web-app-capable", content: "yes" });
  poner("meta", { name: "apple-mobile-web-app-title", content: "Mi boda" });
  poner("meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" });
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute("content", "#7B2D3F");
}

export async function registrarSW() {
  if (!soportaSW()) return null;
  try { await navigator.serviceWorker.register(SW_URL); return await navigator.serviceWorker.ready; } catch { return null; }
}

// "ok" (instalada), "cancelado" o "manual" (el navegador no ofrece el botón: hay que explicarlo)
export async function instalar() {
  if (!promptInstalar) return "manual";
  const p = promptInstalar; promptInstalar = null;
  try { p.prompt(); const r = await p.userChoice; return r.outcome === "accepted" ? "ok" : "cancelado"; } catch { return "manual"; }
}
export const puedeInstalarDirecto = () => !!promptInstalar;

/* ---------- avisos (push) ---------- */
const b64 = s => { const p = "=".repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };

async function recordarPanel(eventoId) {
  try { const c = await caches.open("boda-panel"); await c.put(new URL("panel-" + eventoId, ALCANCE).href, new Response(location.href)); } catch {}
}

export async function suscripcionActual() {
  if (!soportaPush() || Notification.permission !== "granted") return null;
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; }
}

// Pide permiso, se suscribe y registra el dispositivo. Devuelve "ok" | "denegado" | "error"
export async function activarAvisos(key, eventoId) {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return "denegado";
    const reg = await registrarSW();
    if (!reg) return "error";
    const pub = await rpc("boda_push_clave", {});
    if (!pub) return "error";
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(pub) });
    const j = sub.toJSON();
    await rpc("boda_admin_push_guardar", { p_key: key, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    await recordarPanel(eventoId);
    try { await reg.showNotification("¡Avisos activados!", { body: "Te avisaremos cuando alguien responda tu invitación.", icon: ICONO("app-192.png"), badge: ICONO("app-badge.png"), tag: "boda-prueba" }); } catch {}
    return "ok";
  } catch { return "error"; }
}

export async function desactivarAvisos(key) {
  try {
    const sub = await suscripcionActual();
    if (sub) { await rpc("boda_admin_push_quitar", { p_key: key, p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
    return "ok";
  } catch { return "error"; }
}

// Al abrir el panel: si ya estaban activados, vuelve a registrar el dispositivo (por si cambió) y recuerda la dirección.
export async function sincronizarAvisos(key, eventoId) {
  const sub = await suscripcionActual();
  if (!sub) return false;
  try { const j = sub.toJSON(); await rpc("boda_admin_push_guardar", { p_key: key, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }); await recordarPanel(eventoId); } catch {}
  return true;
}
