import { notFound } from "next/navigation";
import { requireRole } from "@/features/identity/ui/session";
import { getSubmittedPracticeReview } from "@/features/practice/application/practice";
import { SubmittedPracticeReview } from "@/features/practice/ui/submitted-practice-review";

export default async function ReviewAttempt({ params }: { params: Promise<{ setId: string; attemptId: string }> }) {
  const [actor, values] = await Promise.all([requireRole(["learner"]), params]);
  const result = await getSubmittedPracticeReview(actor, values);
  if ("error" in result) notFound();
  return <SubmittedPracticeReview review={result.data} />;
}
