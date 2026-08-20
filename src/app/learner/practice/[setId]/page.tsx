import { notFound } from "next/navigation";
import { requireRole } from "@/features/identity/ui/session";
import { preparePractice } from "@/features/practice/application/practice";
import { Preparation } from "@/features/practice/ui/preparation";

export default async function PracticePreparationPage({ params }: { params: Promise<{ setId: string }> }) {
  const [actor, { setId }] = await Promise.all([requireRole(["learner"]), params]);
  const result = await preparePractice(actor, { setId });
  if ("error" in result && result.error.code === "SET_NOT_FOUND") notFound();
  return <Preparation initial={result} />;
}
