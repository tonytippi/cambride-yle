"use client";

import { useRef, useState } from "react";
import { purgeAccountStorage } from "@/features/pwa/ui";

export function SignOutButton({ accountId }: { accountId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [cleaning, setCleaning] = useState(false);
  return <form ref={form} action="/api/auth/sign-out" method="post" onSubmit={(event) => { if (cleaning) return; event.preventDefault(); setCleaning(true); void purgeAccountStorage(accountId).finally(() => form.current?.submit()); }}><button type="submit" className="secondary" disabled={cleaning}>{cleaning ? "Signing out..." : "Sign out"}</button></form>;
}
