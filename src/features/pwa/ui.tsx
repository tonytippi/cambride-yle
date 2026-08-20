"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/service-worker.js"); }, []);
  return null;
}

export async function purgeAccountStorage(accountId: string) {
  const prefix = `cambridgeyle-v1:account:${accountId}`;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.filter((name) => name.startsWith(prefix)).map((name) => caches.delete(name)));
  for (let index = localStorage.length - 1; index >= 0; index -= 1) { const key = localStorage.key(index); if (key?.startsWith(prefix)) localStorage.removeItem(key); }
}
