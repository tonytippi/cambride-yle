import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { cacheNamespace, cacheableMedia, cacheableRequest, isNamespacedKey, namespacedDraftKey } from "@/features/pwa/cache-policy";

describe("PWA cache policy", () => {
  it("allows only same-origin static application shell assets", () => {
    expect(cacheableRequest(new Request("https://app.example.test/_next/static/app.js"))).toBe(true);
    expect(cacheableRequest(new Request("https://app.example.test/api/practice/start"))).toBe(false);
    expect(cacheableRequest(new Request("https://app.example.test/learner"))).toBe(false);
    expect(cacheableRequest(new Request("https://other.example.test/app.js"))).toBe(false);
    expect(cacheableRequest(new Request("https://app.example.test/app.js?token=secret"))).toBe(false);
  });
  it("only accepts explicitly authorised media binaries", () => {
    const request = new Request("https://app.example.test/api/practice/media?token=opaque");
    expect(cacheableMedia(request, new Response("media", { status: 200, headers: { "X-CambridgeYLE-Authorised-Media": "1" } }))).toBe(true);
    expect(cacheableMedia(request, new Response("media", { status: 200 }))).toBe(false);
  });
  it("keeps drafts and account data in their owning namespace", () => {
    const key = namespacedDraftKey("account-a", "attempt-a", "version-a");
    expect(key).toContain(cacheNamespace("account-a"));
    expect(isNamespacedKey(key, "account-a")).toBe(true);
    expect(isNamespacedKey(key, "account-b")).toBe(false);
  });
  it("makes the service worker consume the explicit runtime policy fixture", async () => {
    const [worker, fixture] = await Promise.all([readFile("public/service-worker.js", "utf8"), readFile("public/pwa-cache-policy.js", "utf8")]);
    expect(worker).toContain('importScripts("/pwa-cache-policy.js")');
    expect(worker).toContain("PwaCachePolicy.cacheableShell");
    expect(worker).toContain("PwaCachePolicy.cacheableMedia");
    expect(fixture).toContain("url.pathname === \"/api/practice/media\"");
    expect(fixture).toContain("!url.pathname.startsWith(\"/api/\")");
  });
});
