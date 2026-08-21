import { currentActor } from "@/features/identity/ui/session";
import { getCentreEvidence } from "@/features/evidence/application/get-centre-evidence";
import { IdentityError } from "@/features/identity/application/auth";
import { failure, requestId, success } from "@/shared/http/response";
import { logEvent } from "@/shared/logging/logger";

export async function GET(request: Request) {
  const id = requestId(request);
  const actor = await currentActor();
  if (!actor) { logEvent({ requestId: id, feature: "evidence", action: "read", outcome: "failure", errorCode: "FORBIDDEN" }); return failure("FORBIDDEN", "You do not have access to that page.", 403, id); }
  try {
    const searchParams = new URL(request.url).searchParams;
    const input = Object.fromEntries([...searchParams].map(([key, value]) => [key === "learner" ? "learnerId" : key === "set" ? "practiceSetId" : key, value]));
    const result = await getCentreEvidence(actor, input);
    if ("error" in result) return failure(result.error.code, result.error.message, 400, id);
    logEvent({ requestId: id, actorId: actor.id, feature: "evidence", action: "read", outcome: "success" });
    return success(result.data, 200, id);
  } catch (error) {
    const code = error instanceof IdentityError ? error.code : "EVIDENCE_UNAVAILABLE";
    logEvent({ requestId: id, actorId: actor.id, feature: "evidence", action: "read", outcome: "failure", errorCode: code });
    if (error instanceof IdentityError) return failure(code, "You do not have access to that page.", 403, id);
    return failure(code, "Evidence is temporarily unavailable.", 503, id);
  }
}
