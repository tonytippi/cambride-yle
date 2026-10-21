import "server-only";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { localSignInSchema } from "../domain/contracts";
import { roleHome, signInLocally, type SignInAudience } from "../application/auth";
import { sessionCookieName, sessionCookieOptions } from "./session";
import { logEvent } from "@/shared/logging/logger";

/* Shared by the learner and staff sign-in actions; the audience decides which accounts the page admits. */
export async function signInWithPassword(audience: SignInAudience, formData: FormData) {
  const parsed = localSignInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "We could not sign you in with those details." };
  let role: "learner" | "teacher" | "academic_lead" | "admin";
  try {
    // Host is supplied by the serving boundary, rather than a browser-controlled form field.
    const { actor, token } = await signInLocally(parsed.data.email, parsed.data.password, (await headers()).get("host") ?? "unknown", audience);
    role = actor.role;
    (await cookies()).set(sessionCookieName, token, sessionCookieOptions);
    logEvent({ requestId: "server-action", actorId: actor.id, feature: "identity", action: "local-sign-in", outcome: "success" });
  } catch {
    logEvent({ requestId: "server-action", feature: "identity", action: "local-sign-in", outcome: "failure", errorCode: "SIGN_IN_FAILED" });
    return { error: "We could not sign you in with those details." };
  }
  redirect(roleHome(role));
}
