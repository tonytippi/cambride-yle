import { isDatabaseHealthy } from "@/infrastructure/database/health";
import { logEvent } from "@/shared/logging/logger";
import { failure, requestId, success } from "@/shared/http/response";

export async function GET(request: Request): Promise<Response> {
  const id = requestId(request);
  const databaseHealthy = await isDatabaseHealthy();
  const response = healthResponse(databaseHealthy, id);
  logEvent({ requestId: id, feature: "health", action: "check", outcome: databaseHealthy ? "success" : "failure", ...(databaseHealthy ? {} : { errorCode: "DEPENDENCY_UNAVAILABLE" }) });
  return response;
}

export function healthResponse(databaseHealthy: boolean, id?: string): Response {
  if (!databaseHealthy) return failure("DEPENDENCY_UNAVAILABLE", "Service temporarily unavailable.", 503, id);
  return success({ status: "ok" }, 200, id);
}
