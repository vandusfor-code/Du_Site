"use client";
// Instalación del panel como app + avisos al celular (notificaciones push). Todo opcional.
import { rpc } from "./api";

const SW = "/cumple/sw.js";
const SCOPE = "/cumple/";
const CACHE = "cumple-panel";
const icono = (n: string) => `${location.origin}/cumple/${n}`;

export const soportaSW = () => typeof navigator !== "undefined" && "serviceWorker" in navigator;
export const soportaPush = () => soportaSW() && "PushManager" in window && "Notification" in window;
export const esApp = () => (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

interface PromptInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let promptInstalar: PromptInstalar | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptInstalar = e as PromptInstalar;
  });
}

/** Manifiesto propio del panel: la app abre directo el panel de este evento. */
export function prepararApp(nombre: string) {
  const poner = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
    return el;
  };
  const man = {
    id: location.pathname,
    name: nombre,
    short_name: "Mi cumple",
    description: "Invitados y respuestas de tu cumpleaños",
    start_url: location.href,
    scope: SCOPE,
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF6EC",
    theme_color: "#F07F13",
    lang: "es",
    icons: [
      { src: icono("icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: icono("icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  const nodos: Element[] = [];
  try {
    nodos.push(poner("link", { rel: "manifest", href: URL.createObjectURL(new Blob([JSON.stringify(man)], { type: "application/manifest+json" })) }));
  } catch {}
  nodos.push(poner("link", { rel: "apple-touch-icon", href: icono("icon-180.png") }));
  nodos.push(poner("meta", { name: "apple-mobile-web-app-capable", content: "yes" }));
  nodos.push(poner("meta", { name: "mobile-web-app-capable", content: "yes" }));
  nodos.push(poner("meta", { name: "apple-mobile-web-app-title", content: "Mi cumple" }));
  return () => nodos.forEach((n) => n.remove());
}

export async function registrarSW(): Promise<ServiceWorkerRegistration | null> {
  if (!soportaSW()) return null;
  try {
    await navigator.serviceWorker.register(SW, { scope: SCOPE });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function instalar(): Promise<"ok" | "cancelado" | "manual"> {
  if (!promptInstalar) return "manual";
  const p = promptInstalar;
  promptInstalar = null;
  try {
    await p.prompt();
    const r = await p.userChoice;
    return r.outcome === "accepted" ? "ok" : "cancelado";
  } catch {
    return "manual";
  }
}

const b64 = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

async function recordarPanel(eventoId: string) {
  try {
    const c = await caches.open(CACHE);
    await c.put(new URL(`panel-${eventoId}`, location.origin + SCOPE).href, new Response(location.href));
  } catch {}
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportaPush() || Notification.permission !== "granted") return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SCOPE);
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

export async function activarAvisos(key: string, eventoId: string): Promise<"ok" | "denegado" | "error"> {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return "denegado";
    const reg = await registrarSW();
    if (!reg) return "error";
    const pub = await rpc<string>("boda_push_clave", {});
    if (!pub) return "error";
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(pub) as unknown as BufferSource }));
    const j = sub.toJSON();
    await rpc("boda_admin_push_guardar", { p_key: key, p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth });
    await recordarPanel(eventoId);
    try {
      await reg.showNotification("¡Avisos activados!", { body: "Te avisaremos cuando alguien responda tu invitación.", icon: icono("icon-192.png"), badge: icono("icon-badge.png"), tag: "cumple-prueba" });
    } catch {}
    return "ok";
  } catch {
    return "error";
  }
}

export async function desactivarAvisos(key: string) {
  try {
    const sub = await suscripcionActual();
    if (sub) {
      await rpc("boda_admin_push_quitar", { p_key: key, p_endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {}
}

export async function sincronizarAvisos(key: string, eventoId: string): Promise<boolean> {
  const sub = await suscripcionActual();
  if (!sub) return false;
  try {
    const j = sub.toJSON();
    await rpc("boda_admin_push_guardar", { p_key: key, p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth });
    await recordarPanel(eventoId);
  } catch {}
  return true;
}
