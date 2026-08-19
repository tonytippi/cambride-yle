import { createHmac, timingSafeEqual } from "node:crypto";

const purpose = "session-expired-cleanup";
const lifetimeMs = 60_000;

function signature(token: string, expiresAt: number) {
  return createHmac("sha256", token).update(`${purpose}.${expiresAt}`).digest("base64url");
}

export function createSessionCleanupToken(token: string, now = Date.now()) {
  const expiresAt = now + lifetimeMs;
  return `${expiresAt}.${signature(token, expiresAt)}`;
}

export function verifiesSessionCleanupToken(value: string | null, token: string, now = Date.now()) {
  if (!value || !token) return false;
  const [expiry, received] = value.split(".");
  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now || !received) return false;
  const expected = signature(token, expiresAt);
  const receivedBytes = Buffer.from(received); const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}
