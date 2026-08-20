/* global importScripts */
importScripts("/pwa-cache-policy.js");
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "GET" && url.origin === self.location.origin && url.pathname === "/api/practice/media") {
    event.respondWith(fetch(event.request).then(async (response) => {
      const key = response.headers.get("X-CambridgeYLE-Media-Key");
      const account = response.headers.get("X-CambridgeYLE-Account");
      if (self.PwaCachePolicy.cacheableMedia(event.request, response)) {
        const cache = await caches.open(`cambridgeyle-v1:account:${account}:media`);
        await cache.put(new Request(`/__authorised-media/${key}`), response.clone());
      }
      return response;
    }));
    return;
  }
  if (!self.PwaCachePolicy.cacheableShell(event.request)) return;
  event.respondWith(caches.open("cambridgeyle-v1:shell").then(async (cache) => {
    const cached = await cache.match(event.request);
    const network = fetch(event.request).then((response) => { if (response.ok) cache.put(event.request, response.clone()); return response; });
    return cached || network;
  }));
});
