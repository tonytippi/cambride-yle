import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { getPracticePlayer } from "@/features/practice/application/practice";

export async function GET(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await currentActor();
  const { attemptId } = await params;
  const setId = request.nextUrl.searchParams.get("setId");
  if (!actor) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Learner access is required." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const result = await getPracticePlayer(actor, { setId, attemptId });
  return NextResponse.json(result, { status: "error" in result ? result.error.code === "FORBIDDEN" ? 403 : result.error.code === "ATTEMPT_SCOPE_MISMATCH" ? 404 : result.error.code === "INPUT_INVALID" ? 400 : 409 : 200, headers: { "Cache-Control": "no-store" } });
}
