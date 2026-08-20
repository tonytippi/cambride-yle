self.PwaCachePolicy = {
  cacheableShell(request) {
    const url = new URL(request.url);
    return request.method === "GET" && url.origin === self.location.origin && !url.search && !url.pathname.startsWith("/api/") && /\.(js|css|woff2?|png|svg|ico)$/i.test(url.pathname);
  },
  cacheableMedia(request, response) {
    const url = new URL(request.url);
    return request.method === "GET" && url.origin === self.location.origin && url.pathname === "/api/practice/media" && response.ok && response.headers.get("X-CambridgeYLE-Authorised-Media") === "1" && !!response.headers.get("X-CambridgeYLE-Media-Key") && !!response.headers.get("X-CambridgeYLE-Account");
  },
};
