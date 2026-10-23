// Transbord 3.4.27 — actualització reforçada per a navegador i PWA instal·lada.
const CACHE_NAME = "transbord-cache-v3.4.27";
const SHELL_FILES = [
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/favicon-64.png",
  "./icons/transbord-logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // No reutilitzar còpies HTTP antigues quan es prepara una versió nova.
    await Promise.all(SHELL_FILES.map(async path => {
      const request = new Request(new URL(path, self.registration.scope), { cache: "reload" });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`No s'ha pogut descarregar ${path}`);
      await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("transbord-cache-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Les pàgines sempre intenten obtenir la versió publicada a la xarxa.
  if (request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname === new URL(self.registration.scope).pathname) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL("./index.html", self.registration.scope).href, response.clone());
        }
        return response;
      } catch (error) {
        return (await caches.match(request)) ||
          (await caches.match(new URL("./index.html", self.registration.scope).href)) ||
          Response.error();
      }
    })());
    return;
  }

  // Recursos estàtics: xarxa primer per detectar actualitzacions; memòria cau si no hi ha xarxa.
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response && response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return (await caches.match(request)) || Response.error();
    }
  })());
});
