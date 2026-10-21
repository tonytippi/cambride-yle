import { AccountStorageGuard } from "@/features/pwa/ui";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/features/identity/ui/session";
import { getPracticePlayer, getSubmittedPracticeReview } from "@/features/practice/application/practice";
import { PracticePlayer } from "@/features/practice/ui/practice-player";

export default async function OpenAttemptPlayer({ params }: { params: Promise<{ setId: string; attemptId: string }> }) {
  const [actor, values] = await Promise.all([requireRole(["learner"]), params]);
  const result = await getPracticePlayer(actor, values);
  if ("error" in result) {
    // A finished attempt (for example after a lost submit response) opens its review; one replaced by Start again returns home.
    if (result.error.code !== "ATTEMPT_FINALISED") notFound();
    const review = await getSubmittedPracticeReview(actor, values);
    redirect("data" in review ? `/learner/practice/${values.setId}/attempt/${values.attemptId}/review` : "/learner");
  }
  return <><AccountStorageGuard accountId={actor.id} /><PracticePlayer player={result.data} accountId={actor.id} /></>;
}
