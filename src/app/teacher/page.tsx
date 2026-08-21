import { requireRole } from "@/features/identity/ui/session";
import { getCentreEvidence } from "@/features/evidence/application/get-centre-evidence";
import { EvidenceDashboard } from "@/features/evidence/ui/evidence-dashboard";

export default async function TeacherHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireRole(["teacher", "academic_lead", "admin"]);
  const query = await searchParams;
  const learner = query.learner;
  const input = Object.fromEntries(Object.entries(query).flatMap(([key, value]) => value ? [[key === "learner" ? "learnerId" : key === "set" ? "practiceSetId" : key, value]] : []));
  const result = await getCentreEvidence(actor, input);
  const role = actor.role as "teacher" | "academic_lead" | "admin";
  if ("error" in result) return <main className="shell"><EvidenceDashboard error={result.error.message} learnerId={learner} role={role} /></main>;
  return <main className="shell"><EvidenceDashboard evidence={result.data} learnerId={learner} role={role} /></main>;
}
