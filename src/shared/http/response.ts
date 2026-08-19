import { randomUUID } from "node:crypto";

export const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumRequestIdLength = 128;

export function requestId(request: Request): string {
  const inbound = request.headers.get("x-request-id");
  return inbound && inbound.length <= maximumRequestIdLength && uuidPattern.test(inbound) ? inbound : randomUUID();
}

export function success(data: unknown, status = 200, requestIdentifier?: string): Response {
  return Response.json({ data }, { status, headers: { ...noStoreHeaders, ...(requestIdentifier ? { "X-Request-Id": requestIdentifier } : {}) } });
}

export function failure(code: string, message: string, status: number, requestIdentifier?: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { ...noStoreHeaders, ...(requestIdentifier ? { "X-Request-Id": requestIdentifier } : {}) } });
}
