/* global importScripts */
importScripts("/pwa-cache-policy.js");
self.activeAccounts = new Map();
// The browser may stop an idle worker, so each page client's account is also persisted and reloaded on demand.
const clientAccountCache = "cambridgeyle-v1:clients";
const clientAccountRequest = (clientId) => new Request(`/__client-account/${encodeURIComponent(clientId)}`);
async function rememberClientAccount(clientId, accountId) { await (await caches.open(clientAccountCache)).put(clientAccountRequest(clientId), new Response(accountId)); }
async function forgetClientAccount(clientId) { await (await caches.open(clientAccountCache)).delete(clientAccountRequest(clientId)); }
async function activeAccountFor(clientId) {
  if (!clientId) return undefined;
  if (self.activeAccounts.has(clientId)) return self.activeAccounts.get(clientId);
  const stored = await (await caches.open(clientAccountCache)).match(clientAccountRequest(clientId));
  if (!stored) return undefined;
  const accountId = await stored.text();
  self.activeAccounts.set(clientId, accountId);
  return accountId;
}
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const live = new Set((await self.clients.matchAll({ includeUncontrolled: true })).map((client) => client.id));
    const cache = await caches.open(clientAccountCache);
    await Promise.all((await cache.keys()).filter((request) => !live.has(decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? ""))).map((request) => cache.delete(request)));
  })());
});
self.addEventListener("message", (event) => {
  if (!event.source?.id || !event.data || typeof event.data !== "object") return;
  if (event.data.type === "cambridgeyle-active-account" && typeof event.data.accountId === "string") { self.activeAccounts.set(event.source.id, event.data.accountId); event.waitUntil(rememberClientAccount(event.source.id, event.data.accountId)); }
  if (event.data.type === "cambridgeyle-clear-account") { self.activeAccounts.delete(event.source.id); event.waitUntil(forgetClientAccount(event.source.id)); }
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "GET" && url.origin === self.location.origin && url.pathname === "/api/practice/media") {
    event.respondWith(fetch(event.request).then(async (response) => {
      const key = response.headers.get("X-CambridgeYLE-Media-Key");
      const account = response.headers.get("X-CambridgeYLE-Account");
      if (self.PwaCachePolicy.cacheableMedia(event.request, response)) {
        try {
          const cache = await caches.open(`cambridgeyle-v1:account:${account}:media`);
          const requestUrl = new URL(event.request.url);
          await cache.put(new Request(`/__authorised-media/${encodeURIComponent(account)}/${requestUrl.searchParams.get("attemptId")}/${requestUrl.searchParams.get("setVersionId")}/${key}`), response.clone());
        } catch { /* Cache failures must not replace an authorised network response. */ }
      }
      return response;
    }).catch(async () => {
      const account = url.searchParams.get("accountId");
      const attempt = url.searchParams.get("attemptId");
      const setVersion = url.searchParams.get("setVersionId");
      const mediaKey = url.searchParams.get("mediaKey");
      const activeAccount = await activeAccountFor(event.clientId);
      if (!account || !attempt || !setVersion || !mediaKey || activeAccount !== account) return Response.error();
      const cache = await caches.open(`cambridgeyle-v1:account:${account}:media`);
      return (await cache.match(new Request(`/__authorised-media/${encodeURIComponent(account)}/${attempt}/${setVersion}/${mediaKey}`))) ?? Response.error();
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
