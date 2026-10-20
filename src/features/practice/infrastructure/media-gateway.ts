import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverConfig } from "@/shared/config/server";
import { getObject, hasObject, isObjectStoreConfigured } from "@/infrastructure/storage/object-store";

type MediaReference = { id: string; objectVersion: string; contentHash: string };
type MediaCapability = MediaReference & { learnerId: string; expiresAt: number };

function configured() {
  return isObjectStoreConfigured() && !!serverConfig.MEDIA_SIGNING_SECRET;
}

export function isMediaGatewayConfigured() { return configured(); }

function signature(value: string) {
  return createHmac("sha256", serverConfig.MEDIA_SIGNING_SECRET!).update(value).digest("base64url");
}

function encode(capability: MediaCapability) {
  const value = Buffer.from(JSON.stringify(capability)).toString("base64url");
  return `${value}.${signature(value)}`;
}

export function verifyMediaCapability(token: string): MediaCapability | undefined {
  if (!configured()) return undefined;
  const [value, supplied] = token.split(".");
  if (!value || !supplied) return undefined;
  const expected = signature(value);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return undefined;
  try {
    const capability = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as MediaCapability;
    return capability.expiresAt > Date.now() && capability.id && capability.objectVersion && capability.contentHash && capability.learnerId ? capability : undefined;
  } catch { return undefined; }
}

export async function authoriseMedia(learnerId: string, media: MediaReference) {
  if (!configured()) return undefined;
  if (!(await hasObject(media.objectVersion))) return undefined;
  const token = encode({ ...media, learnerId, expiresAt: Date.now() + 5 * 60_000 });
  return { url: `/api/practice/media?token=${encodeURIComponent(token)}`, cacheKey: `media/${media.id}/${media.contentHash}` };
}

export async function fetchAuthorisedMedia(capability: MediaCapability) {
  if (!configured()) return undefined;
  return getObject(capability.objectVersion);
}
