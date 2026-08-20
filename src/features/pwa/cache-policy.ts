export const pwaCachePrefix = "cambridgeyle-v1";

export function cacheNamespace(accountId: string) { return `${pwaCachePrefix}:account:${accountId}`; }
export function namespacedDraftKey(accountId: string, attemptId: string, setVersionId: string) { return `${cacheNamespace(accountId)}:attempt:${attemptId}:set:${setVersionId}`; }
export function isNamespacedKey(key: string, accountId: string) { return key.startsWith(`${cacheNamespace(accountId)}:`); }
export function mediaCacheName(accountId: string) { return `${cacheNamespace(accountId)}:media`; }
export function mediaCacheKey(accountId: string, attemptId: string, setVersionId: string, mediaKey: string) { return `/__authorised-media/${encodeURIComponent(accountId)}/${attemptId}/${setVersionId}/${mediaKey}`; }

export function mediaFallbackRequest(request: Request, origin = "https://app.example.test") {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const mediaId = url.searchParams.get("mediaId");
  const attemptId = url.searchParams.get("attemptId");
  const setVersionId = url.searchParams.get("setVersionId");
  const mediaKey = url.searchParams.get("mediaKey");
  return request.method === "GET" && url.origin === origin && url.pathname === "/api/practice/media" && !!accountId && !!mediaId && !!attemptId && !!setVersionId && !!mediaKey ? { accountId, mediaId, attemptId, setVersionId, mediaKey } : undefined;
}

export function cacheableRequest(request: Request, origin = "https://app.example.test") {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== origin) return false;
  if (url.search || url.pathname.startsWith("/api/")) return false;
  return /\.(?:js|css|woff2?|png|svg|ico)$/i.test(url.pathname);
}

export function cacheableMedia(request: Request, response: Response, origin = "https://app.example.test") {
  const fallback = mediaFallbackRequest(request, origin);
  const key = response.headers.get("X-CambridgeYLE-Media-Key");
  return !!fallback && response.ok && response.headers.get("X-CambridgeYLE-Authorised-Media") === "1" && response.headers.get("X-CambridgeYLE-Account") === fallback.accountId && key === fallback.mediaKey && key.startsWith(`${fallback.mediaId}/`);
}
