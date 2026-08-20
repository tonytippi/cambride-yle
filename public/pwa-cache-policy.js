self.PwaCachePolicy = {
  cacheableShell(request) {
    const url = new URL(request.url);
    return request.method === "GET" && url.origin === self.location.origin && !url.search && !url.pathname.startsWith("/api/") && /\.(js|css|woff2?|png|svg|ico)$/i.test(url.pathname);
  },
  cacheableMedia(request, response) {
    const url = new URL(request.url);
    const account = url.searchParams.get("accountId");
    const media = url.searchParams.get("mediaId");
    const attempt = url.searchParams.get("attemptId");
    const setVersion = url.searchParams.get("setVersionId");
    const mediaKey = url.searchParams.get("mediaKey");
    const key = response.headers.get("X-CambridgeYLE-Media-Key");
    return request.method === "GET" && url.origin === self.location.origin && url.pathname === "/api/practice/media" && !!account && !!media && !!attempt && !!setVersion && !!mediaKey && response.ok && response.headers.get("X-CambridgeYLE-Authorised-Media") === "1" && response.headers.get("X-CambridgeYLE-Account") === account && key === mediaKey && key.startsWith(`${media}/`);
  },
};
