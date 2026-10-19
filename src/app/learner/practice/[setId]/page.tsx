import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/features/identity/ui/session";
import { preparePractice } from "@/features/practice/application/practice";
import { Preparation } from "@/features/practice/ui/preparation";

export default async function PracticePreparationPage({ params, searchParams }: { params: Promise<{ setId: string }>; searchParams: Promise<{ restart?: string }> }) {
  const [actor, { setId }, { restart }] = await Promise.all([requireRole(["learner"]), params, searchParams]);
  const replaceAttemptId = z.string().uuid().safeParse(restart).data;
  const result = await preparePractice(actor, { setId });
  if ("error" in result && result.error.code === "SET_NOT_FOUND") notFound();
  return <Preparation initial={result} replaceAttemptId={replaceAttemptId} />;
}
