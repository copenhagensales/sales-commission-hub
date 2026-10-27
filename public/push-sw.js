/* Push-håndtering. Indlæses i Storks service worker via workbox.importScripts.
   Rører ikke precache eller NetworkOnly-regler. */
function sikkerUrl(raw) {
  let u;
  try { u = new URL(raw || "/", self.location.origin); } catch (_) { u = null; }
  if (!u || u.origin !== self.location.origin) u = new URL("/", self.location.origin);
  return u;
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || "Stork";
  const u = sikkerUrl(data.url);
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.renotify && !!data.tag,
      data: { url: u.pathname + u.search + u.hash },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const u = sikkerUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const egne = all.filter((c) => c.url.startsWith(self.location.origin));
      for (const c of egne) {
        const cu = new URL(c.url);
        if (cu.pathname + cu.search === u.pathname + u.search) { await c.focus(); return; }
      }
      const c = egne[0];
      if (c) {
        await c.focus();
        if ("navigate" in c) await c.navigate(u.href);
        return;
      }
      await self.clients.openWindow(u.href);
    })(),
  );
});
