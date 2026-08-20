import { requireRole } from "@/features/identity/ui/session";
import { getCentreEvidence } from "@/features/evidence/application/get-centre-evidence";
import { EvidenceDashboard } from "@/features/evidence/ui/evidence-dashboard";

export default async function TeacherHome({ searchParams }: { searchParams: Promise<{ learner?: string }> }) {
  const actor = await requireRole(["teacher", "academic_lead", "admin"]);
  const { learner } = await searchParams;
  const result = await getCentreEvidence(actor, learner === undefined ? {} : { learnerId: learner });
  if ("error" in result) return <main className="shell"><EvidenceDashboard error={result.error.message} learnerId={learner} /></main>;
  return <main className="shell"><EvidenceDashboard evidence={result.data} learnerId={learner} /></main>;
}
