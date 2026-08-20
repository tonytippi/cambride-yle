import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { cacheNamespace, cacheableMedia, cacheableRequest, isNamespacedKey, mediaCacheKey, mediaCacheName, namespacedDraftKey } from "@/features/pwa/cache-policy";
import { createOpenAttemptDraft, draftResponses, shouldApplyDraftHydration, usableDraft, validDraft } from "@/features/pwa/open-attempt-drafts";
import { attemptMediaSchema } from "@/features/practice/domain/contracts";

describe("PWA cache policy", () => {
  it("allows only same-origin static application shell assets", () => {
    expect(cacheableRequest(new Request("https://app.example.test/_next/static/app.js"))).toBe(true);
    expect(cacheableRequest(new Request("https://app.example.test/api/practice/start"))).toBe(false);
    expect(cacheableRequest(new Request("https://app.example.test/learner"))).toBe(false);
    expect(cacheableRequest(new Request("https://other.example.test/app.js"))).toBe(false);
    expect(cacheableRequest(new Request("https://app.example.test/app.js?token=secret"))).toBe(false);
  });
  it("only accepts explicitly authorised media binaries", () => {
    const request = new Request("https://app.example.test/api/practice/media?attemptId=open&setVersionId=version-a&mediaId=media-a&mediaKey=media-a%2Fhash&accountId=account-a");
    expect(cacheableMedia(request, new Response("media", { status: 200, headers: { "X-CambridgeYLE-Authorised-Media": "1", "X-CambridgeYLE-Account": "account-a", "X-CambridgeYLE-Media-Key": "media-a/hash" } }))).toBe(true);
    expect(cacheableMedia(request, new Response("media", { status: 200 }))).toBe(false);
    expect(cacheableMedia(request, new Response("media", { status: 200, headers: { "X-CambridgeYLE-Authorised-Media": "1", "X-CambridgeYLE-Account": "account-b", "X-CambridgeYLE-Media-Key": "media-a/hash" } }))).toBe(false);
    expect(cacheableMedia(request, new Response("media", { status: 200, headers: { "X-CambridgeYLE-Authorised-Media": "1", "X-CambridgeYLE-Account": "account-a", "X-CambridgeYLE-Media-Key": "media-a/older-hash" } }))).toBe(false);
  });
  it("keeps drafts and account data in their owning namespace", () => {
    const key = namespacedDraftKey("account-a", "attempt-a", "version-a");
    expect(key).toContain(cacheNamespace("account-a"));
    expect(isNamespacedKey(key, "account-a")).toBe(true);
    expect(isNamespacedKey(key, "account-b")).toBe(false);
    expect(mediaCacheName("account-a")).toBe(`${cacheNamespace("account-a")}:media`);
    expect(mediaCacheKey("account-a", "attempt-a", "version-a", "media-a/hash")).toContain("account-a/attempt-a/version-a/media-a/hash");
  });
  it("accepts only an exact current-revision open draft", () => {
    const draft = createOpenAttemptDraft("account-a", "attempt-a", "version-a", 2, { "item-a": "cat" });
    expect(usableDraft(draft, "account-a", "attempt-a", "version-a", 2)).toBe(true);
    expect(usableDraft(draft, "account-a", "attempt-a", "version-a", 3)).toBe(false);
    expect(usableDraft(draft, "account-b", "attempt-a", "version-a", 2)).toBe(false);
    expect(validDraft({ ...draft, attemptId: "attempt-b" }, "account-a", "attempt-a", "version-a")).toBe(false);
    expect(validDraft({ ...draft, setVersionId: "version-b" }, "account-a", "attempt-a", "version-a")).toBe(false);
    expect(validDraft({ ...draft, accountId: "account-b" }, "account-a", "attempt-a", "version-a")).toBe(false);
    expect(validDraft({ ...draft, savedAt: Number.NaN }, "account-a", "attempt-a", "version-a")).toBe(false);
    expect(draftResponses({ "item-a": "cat", "item-b": null })).toEqual({ "item-a": "cat", "item-b": null });
    expect(draftResponses({ "item-a": { answer: "cat" } })).toBeUndefined();
    expect(shouldApplyDraftHydration(1, 1)).toBe(true);
    expect(shouldApplyDraftHydration(1, 2)).toBe(false);
  });
  it("fails closed when an authorised media scope parameter is missing", () => {
    const valid = { setId: "018f0000-0000-7000-8000-000000000001", attemptId: "018f0000-0000-7000-8000-000000000002", setVersionId: "018f0000-0000-7000-8000-000000000003", mediaId: "018f0000-0000-7000-8000-000000000004", mediaKey: "018f0000-0000-7000-8000-000000000004/hash" };
    expect(attemptMediaSchema.safeParse(valid).success).toBe(true);
    for (const key of Object.keys(valid)) { const incomplete = { ...valid }; delete incomplete[key as keyof typeof valid]; expect(attemptMediaSchema.safeParse(incomplete).success).toBe(false); }
  });
  it("makes the service worker consume the explicit runtime policy fixture", async () => {
    const [worker, fixture] = await Promise.all([readFile("public/service-worker.js", "utf8"), readFile("public/pwa-cache-policy.js", "utf8")]);
    expect(worker).toContain('importScripts("/pwa-cache-policy.js")');
    expect(worker).toContain("PwaCachePolicy.cacheableShell");
    expect(worker).toContain("PwaCachePolicy.cacheableMedia");
    expect(worker).toContain("Response.error()");
    expect(worker).toContain("cambridgeyle-active-account");
    expect(worker).toContain("activeAccount !== account");
    expect(worker).toContain("/${attempt}/${setVersion}/${mediaKey}");
    expect(worker).toContain("Cache failures must not replace an authorised network response.");
    expect(worker).toContain("return response;");
    expect(fixture).toContain("url.pathname === \"/api/practice/media\"");
    expect(fixture).toContain("!url.pathname.startsWith(\"/api/\")");
  });
});
