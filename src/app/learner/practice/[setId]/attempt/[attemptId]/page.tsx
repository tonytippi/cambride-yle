import { notFound } from "next/navigation";
import { requireRole } from "@/features/identity/ui/session";
import { getOpenPracticeAttempt } from "@/features/practice/application/practice";

export default async function OpenAttemptPlaceholder({ params }: { params: Promise<{ setId: string; attemptId: string }> }) {
  const [actor, values] = await Promise.all([requireRole(["learner"]), params]);
  const result = await getOpenPracticeAttempt(actor, values);
  if ("error" in result) notFound();
  return <main className="shell"><section className="preparation"><p className="eyebrow">Practice activity</p><h1>Your practice is ready</h1><p role="status">Your work is safely open. Questions will appear here next.</p><a className="practice-action secondary-link" href="/learner">Save and leave</a></section></main>;
}
