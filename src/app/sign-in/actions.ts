"use server";
import { redirect } from "next/navigation";
import { localSignInSchema } from "@/features/identity/domain/contracts";
import { roleHome, signInLocally } from "@/features/identity/application/auth";
import { sessionCookieName, sessionCookieOptions } from "@/features/identity/ui/session";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { logEvent } from "@/shared/logging/logger";

export async function signInAction(_: { error?: string }, formData: FormData) {
  const parsed = localSignInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "We could not sign you in with those details." };
  let role: "learner" | "teacher" | "academic_lead" | "admin";
  try {
    // Host is supplied by the serving boundary, rather than a browser-controlled form field.
    const { actor, token } = await signInLocally(parsed.data.email, parsed.data.password, (await headers()).get("host") ?? "unknown");
    role = actor.role;
    (await cookies()).set(sessionCookieName, token, sessionCookieOptions);
    logEvent({ requestId: "server-action", actorId: actor.id, feature: "identity", action: "local-sign-in", outcome: "success" });
  } catch {
    logEvent({ requestId: "server-action", feature: "identity", action: "local-sign-in", outcome: "failure", errorCode: "SIGN_IN_FAILED" });
    return { error: "We could not sign you in with those details." };
  }
  redirect(roleHome(role));
}
