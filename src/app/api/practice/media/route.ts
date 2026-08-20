import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { fetchAuthorisedMedia, verifyMediaCapability } from "@/features/practice/infrastructure/media-gateway";
import { getAttemptMedia } from "@/features/practice/application/practice";

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  const token = request.nextUrl.searchParams.get("token");
  const capability = token ? verifyMediaCapability(token) : undefined;
  const attemptMedia = !token && actor ? await getAttemptMedia(actor, { setId: request.nextUrl.searchParams.get("setId"), attemptId: request.nextUrl.searchParams.get("attemptId"), setVersionId: request.nextUrl.searchParams.get("setVersionId"), mediaId: request.nextUrl.searchParams.get("mediaId"), mediaKey: request.nextUrl.searchParams.get("mediaKey") }) : undefined;
  const scoped = capability && actor?.role === "learner" && capability.learnerId === actor.id ? capability : attemptMedia && actor ? { ...attemptMedia, learnerId: actor.id, expiresAt: Date.now() + 1 } : undefined;
  if (!scoped) return new NextResponse(null, { status: 404 });
  const media = await fetchAuthorisedMedia(scoped);
  if (!media) return new NextResponse(null, { status: 404 });
  return new NextResponse(media.body, { headers: { "Content-Type": media.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-CambridgeYLE-Authorised-Media": "1", "X-CambridgeYLE-Media-Key": `${scoped.id}/${scoped.contentHash}`, "X-CambridgeYLE-Account": scoped.learnerId } });
}
