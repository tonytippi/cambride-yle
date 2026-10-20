import { NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { getMediaFile } from "@/features/content/application/content";
import { getObject } from "@/infrastructure/storage/object-store";

/* Staff preview of a media version's private file; never cached and never exposed to learners. */
export async function GET(_request: Request, ctx: { params: Promise<{ mediaId: string }> }) {
  const actor = await currentActor();
  if (!actor) return new NextResponse(null, { status: 404 });
  const { mediaId } = await ctx.params;
  const file = await getMediaFile(actor, mediaId).catch(() => undefined);
  const object = file && (await getObject(file.objectKey));
  if (!file || !object) return new NextResponse(null, { status: 404 });
  return new NextResponse(object.body, { headers: { "Content-Type": file.contentType, "Content-Length": String(file.byteSize), "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
