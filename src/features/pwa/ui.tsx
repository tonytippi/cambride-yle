"use client";

import { useEffect } from "react";
import { cacheNamespace } from "./cache-policy";
import { openAttemptDraftStore } from "./open-attempt-drafts";

export function PwaRegistration() {
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/service-worker.js"); }, []);
  return null;
}

export async function purgeAccountStorage(accountId: string) {
  const prefix = cacheNamespace(accountId);
  const tasks = [
    (async () => { const cacheNames = await caches.keys(); await Promise.all(cacheNames.filter((name) => name.startsWith(prefix)).map((name) => caches.delete(name))); })(),
    (async () => { for (let index = localStorage.length - 1; index >= 0; index -= 1) { const key = localStorage.key(index); if (key?.startsWith(prefix)) localStorage.removeItem(key); } })(),
    openAttemptDraftStore.purgeAccount(accountId),
  ];
  await Promise.allSettled(tasks);
}
