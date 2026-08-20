import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { fetchAuthorisedMedia, verifyMediaCapability } from "@/features/practice/infrastructure/media-gateway";

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  const token = request.nextUrl.searchParams.get("token");
  const capability = token ? verifyMediaCapability(token) : undefined;
  if (!actor || actor.role !== "learner" || !capability || capability.learnerId !== actor.id) return new NextResponse(null, { status: 404 });
  const media = await fetchAuthorisedMedia(capability);
  if (!media) return new NextResponse(null, { status: 404 });
  return new NextResponse(media.body, { headers: { "Content-Type": media.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-CambridgeYLE-Authorised-Media": "1", "X-CambridgeYLE-Media-Key": `${capability.id}/${capability.contentHash}`, "X-CambridgeYLE-Account": capability.learnerId } });
}
