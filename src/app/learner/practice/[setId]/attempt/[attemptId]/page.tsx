import { notFound } from "next/navigation";
import { requireRole } from "@/features/identity/ui/session";
import { getPracticePlayer } from "@/features/practice/application/practice";
import { PracticePlayer } from "@/features/practice/ui/practice-player";

export default async function OpenAttemptPlayer({ params }: { params: Promise<{ setId: string; attemptId: string }> }) {
  const [actor, values] = await Promise.all([requireRole(["learner"]), params]);
  const result = await getPracticePlayer(actor, values);
  if ("error" in result) notFound();
  return <PracticePlayer player={result.data} />;
}
