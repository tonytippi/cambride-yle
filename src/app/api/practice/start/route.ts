import { NextRequest, NextResponse } from "next/server";
import { currentActor } from "@/features/identity/ui/session";
import { startPractice } from "@/features/practice/application/practice";

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Learner access is required." } }, { status: 403 });
  try {
    const result = await startPractice(actor, await request.json());
    const status = "error" in result ? result.error.code === "FORBIDDEN" ? 403 : result.error.code === "INPUT_INVALID" ? 400 : 409 : 201;
    return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: { code: "SET_NOT_FOUND", message: "This practice activity is no longer available." } }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
