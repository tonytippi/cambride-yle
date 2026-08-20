import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { recordPracticePlayback } from "@/features/practice/application/practice";

export async function POST(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await currentActor();
  const { attemptId } = await params;
  if (!actor) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Learner access is required." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await recordPracticePlayback(actor, { ...await request.json(), attemptId });
    return NextResponse.json(result, { status: "error" in result ? result.error.code === "FORBIDDEN" ? 403 : result.error.code === "ATTEMPT_SCOPE_MISMATCH" ? 404 : result.error.code === "INPUT_INVALID" ? 400 : 409 : 201, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: { code: "INPUT_INVALID", message: "Replay this audio again." } }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
