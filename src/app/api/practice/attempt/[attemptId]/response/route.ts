import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { savePracticeResponse } from "@/features/practice/application/practice";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await currentActor();
  const { attemptId } = await params;
  if (!actor) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Learner access is required." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await savePracticeResponse(actor, { ...await request.json(), attemptId });
    return NextResponse.json(result, { status: "error" in result ? result.error.code === "FORBIDDEN" ? 403 : result.error.code === "ATTEMPT_SCOPE_MISMATCH" ? 404 : result.error.code === "INPUT_INVALID" ? 400 : 409 : 200, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: { code: "INPUT_INVALID", message: "Enter a valid answer." } }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
