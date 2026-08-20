import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { submitPracticeAttempt } from "@/features/practice/application/practice";

export async function POST(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Learner access is required." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const { attemptId } = await params;
    const result = await submitPracticeAttempt(actor, { ...await request.json(), attemptId });
    const status = "error" in result ? result.error.code === "FORBIDDEN" ? 403 : result.error.code === "ATTEMPT_SCOPE_MISMATCH" ? 404 : result.error.code === "INPUT_INVALID" ? 400 : 409 : 200;
    return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: { code: "INPUT_INVALID", message: "Reconnect and submit your practice again." } }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
