"use client";

import { useEffect } from "react";
import { openAttemptDraftStore } from "./open-attempt-drafts";
import { cacheNamespace, clientAccountCacheName, lastAccountKey } from "./cache-policy";

export function PwaRegistration() {
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/service-worker.js"); }, []);
  return null;
}

/* When a different learner opens a learner page on this device, the previous learner's local data is removed.
   The same learner returning (for example after their session expired) keeps unsynced drafts. */
export function AccountStorageGuard({ accountId }: { accountId: string }) {
  useEffect(() => {
    try {
      const previous = localStorage.getItem(lastAccountKey);
      if (previous && previous !== accountId) void purgeAccountStorage(previous);
      localStorage.setItem(lastAccountKey, accountId);
    } catch { /* Without local storage nothing was kept for another account. */ }
  }, [accountId]);
  return null;
}

export async function purgeAccountStorage(accountId: string) {
  const prefix = cacheNamespace(accountId);
  const tasks = [
    (async () => { if (localStorage.getItem(lastAccountKey) === accountId) localStorage.removeItem(lastAccountKey); })(),
    (async () => { const cache = await caches.open(clientAccountCacheName); await Promise.all((await cache.keys()).map(async (request) => { if (await (await cache.match(request))?.text() === accountId) await cache.delete(request); })); })(),
    (async () => { const cacheNames = await caches.keys(); await Promise.all(cacheNames.filter((name) => name.startsWith(prefix)).map((name) => caches.delete(name))); })(),
    (async () => { for (let index = localStorage.length - 1; index >= 0; index -= 1) { const key = localStorage.key(index); if (key?.startsWith(prefix)) localStorage.removeItem(key); } })(),
    openAttemptDraftStore.purgeAccount(accountId),
  ];
  await Promise.allSettled(tasks);
}

/* Shown on sign-in after the server reports that this device's learner account was deactivated: that learner's drafts and cached media are removed. */
export function DeactivatedAccountCleanup({ accountId }: { accountId: string }) {
  useEffect(() => {
    void purgeAccountStorage(accountId).finally(() => { try { history.replaceState(null, "", "/sign-in"); } catch { /* The notice still shows. */ } });
  }, [accountId]);
  return <p className="notice" role="status">This account is closed. Practice saved on this device for it has been removed. Ask your teacher if you need help.</p>;
}
