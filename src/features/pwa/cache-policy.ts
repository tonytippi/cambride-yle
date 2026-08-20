export const pwaCachePrefix = "cambridgeyle-v1";

export function cacheNamespace(accountId: string) { return `${pwaCachePrefix}:account:${accountId}`; }
export function namespacedDraftKey(accountId: string, attemptId: string, setVersionId: string) { return `${cacheNamespace(accountId)}:attempt:${attemptId}:set:${setVersionId}`; }
export function isNamespacedKey(key: string, accountId: string) { return key.startsWith(`${cacheNamespace(accountId)}:`); }

export function cacheableRequest(request: Request, origin = "https://app.example.test") {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== origin) return false;
  if (url.search || url.pathname.startsWith("/api/")) return false;
  return /\.(?:js|css|woff2?|png|svg|ico)$/i.test(url.pathname);
}

export function cacheableMedia(request: Request, response: Response, origin = "https://app.example.test") {
  const url = new URL(request.url);
  return request.method === "GET" && url.origin === origin && url.pathname === "/api/practice/media" && response.ok && response.headers.get("X-CambridgeYLE-Authorised-Media") === "1";
}
