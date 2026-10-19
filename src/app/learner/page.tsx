import { AccountStorageGuard } from "@/features/pwa/ui";
import { requireRole } from "@/features/identity/ui/session";
import { getLearnerHome } from "@/features/practice/application/practice";
import { LearnerHome } from "@/features/practice/ui/learner-home";
export default async function LearnerPage({ searchParams }: { searchParams: Promise<{ notice?: string; topic?: string; taskType?: string }> }) { const [actor, params] = await Promise.all([requireRole(["learner"]), searchParams]); return <><AccountStorageGuard accountId={actor.id} /><LearnerHome actor={actor} home={await getLearnerHome(actor, { topic: params.topic, taskType: params.taskType })} notice={params.notice} /></>; }
