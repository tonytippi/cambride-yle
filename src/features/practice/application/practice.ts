import type { Actor } from "@/features/identity/domain/contracts";
import { learnerHomeFilterSchema, type LearnerHome, type LearnerPracticeSet, type SubmittedEvidence } from "../domain/contracts";
import * as repository from "../infrastructure/repositories";

const recommendationVersion = "learner-home-v1";

function latestEvidenceBySet(evidence: SubmittedEvidence[]) {
  const latestAttempts = new Set<string>();
  const selected: SubmittedEvidence[] = [];
  for (const item of evidence) {
    if (!latestAttempts.has(item.practiceSetId)) {
      latestAttempts.add(item.practiceSetId);
      selected.push(item);
    } else if (selected.some((chosen) => chosen.practiceSetId === item.practiceSetId && chosen.attemptId === item.attemptId)) selected.push(item);
  }
  return selected;
}

export async function getLearnerHome(actor: Actor, requestedFilters: { topic?: string; taskType?: string } = {}): Promise<LearnerHome> {
  if (actor.role !== "learner") throw Object.assign(new Error("Learner access is required."), { code: "FORBIDDEN" });
  const valid = learnerHomeFilterSchema.parse(requestedFilters);
  const rows = await repository.listPublishedSetsForLearner(actor.id);
  const allSets: LearnerPracticeSet[] = rows.map((row) => ({
    ...row,
    paper: row.paper,
    targetIds: row.targetIds as string[],
    action: (row.openLastSavedAt ? "Resume" : row.submittedAttemptId ? "Review" : "Start") as LearnerPracticeSet["action"],
    lastSavedAt: row.openLastSavedAt ?? undefined,
  }));
  const filters = { topic: valid.topic || undefined, taskType: valid.taskType || undefined, topics: [...new Set(allSets.map((set) => set.topic))], taskTypes: [...new Set(allSets.map((set) => set.taskType))] };
  const sets = allSets.filter((set) => (!filters.topic || set.topic === filters.topic) && (!filters.taskType || set.taskType === filters.taskType));
  const evidence = latestEvidenceBySet(await repository.listRecentSubmittedEvidence(actor.id, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const assessable = evidence.filter((item) => item.label !== "not_assessed_yet");
  if (assessable.length < 3) return { allSets, sets, filters, recommendation: undefined };
  const labelByArea = new Map<string, "building" | "needs_practice">();
  for (const item of assessable)
    if (item.label === "needs_practice" || (item.label === "building" && !labelByArea.has(item.practiceAreaId))) labelByArea.set(item.practiceAreaId, item.label);
  const ranked = [...allSets].sort((a, b) => {
    const rank = (set: LearnerPracticeSet) => set.targetIds.some((id) => labelByArea.get(id) === "needs_practice") ? 0 : set.targetIds.some((id) => labelByArea.get(id) === "building") ? 1 : 2;
    return rank(a) - rank(b) || a.title.localeCompare(b.title, "en-GB");
  }).slice(0, 3);
  const matchingArea = [...labelByArea.entries()].find(([, label]) => label === "needs_practice") ?? [...labelByArea.entries()].find(([, label]) => label === "building");
  if (!ranked.length || !matchingArea) return { allSets, sets, filters, recommendation: undefined };
  const recommendation = { version: recommendationVersion, setIds: ranked.map((set) => set.id), practiceArea: matchingArea[0] };
  await repository.recordRecommendation(actor.id, recommendation.version, recommendation.setIds);
  return { allSets, sets, filters, recommendation };
}
