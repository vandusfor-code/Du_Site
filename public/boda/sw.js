/* Service worker del panel de la boda.
   Hace dos cosas: permite instalar el panel como app y muestra los avisos
   (notificaciones push) cuando un invitado responde. No guarda páginas en caché. */
const ICONO = new URL("img/app-192.png", self.registration.scope).href;
const INSIGNIA = new URL("img/app-badge.png", self.registration.scope).href;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Nueva respuesta", {
    body: d.body || "",
    icon: ICONO,
    badge: INSIGNIA,
    tag: d.tag || "boda-respuesta",
    renotify: true,
    data: { evento: d.evento || "" }
  }));
});

// Al tocar el aviso: vuelve al panel (o lo abre). La dirección del panel la guarda la propia página.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const evento = (e.notification.data && e.notification.data.evento) || "";
  e.waitUntil((async () => {
    let url = self.registration.scope;
    try {
      const c = await caches.open("boda-panel");
      const r = await c.match(new URL("panel-" + evento, self.registration.scope).href);
      if (r) url = await r.text();
    } catch {}
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of abiertas) {
      if (w.url.indexOf("admin=") !== -1 && "focus" in w) {
        try { await w.focus(); if ("navigate" in w) await w.navigate(url); } catch {}
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
