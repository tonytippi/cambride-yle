import type { Actor } from "@/features/identity/domain/contracts";
import { z } from "zod";
import { attemptMediaSchema, learnerHomeFilterSchema, playbackSchema, preparePracticeSchema, practiceAttemptSchema, responseSchema, startPracticeSchema, submitAttemptSchema, type LearnerHome, type LearnerPracticeSet, type OpenPracticeAttempt, type PracticePlayer, type PracticePreparation, type PracticeResult, type PracticeStart, type SubmittedPracticeResult, type SubmittedPracticeReview } from "../domain/contracts";
import * as repository from "../infrastructure/repositories";
import { evidenceState, latestFactsPerSet } from "@/features/evidence/domain/evidence-state";
import type { SubmittedEvidenceFact } from "./evidence-contract";

const recommendationVersion = "learner-home-v2";

const paperNames = { listening: "Listening", reading_writing: "Reading and Writing" } as const;
/* Child-facing practice area: short controlled guidance text, else the readable canonical id, with its paper and part. */
const practiceAreaLabel = (target: { guidance: string; canonicalId: string } | undefined, paper: keyof typeof paperNames, part: string) => {
  const name = target && target.guidance.trim().length <= 60 ? target.guidance.trim() : target ? target.canonicalId.replace(/-/g, " ").replace(/^./, (first) => first.toLocaleUpperCase("en-GB")) : "Recent practice";
  return `${name} · ${paperNames[paper]} Part ${part}`;
};

/* Practice areas use the teacher evidence rule: latest attempt per set in 30 days, grouped by paper/part and language target. */
async function practiceAreas(learnerId: string) {
  const facts = latestFactsPerSet(await repository.listLearnerEvidenceFacts(learnerId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const groups = new Map<string, SubmittedEvidenceFact[]>();
  for (const fact of facts) {
    const key = `${fact.paper}\0${fact.part}\0${fact.languageTargetId}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const rate = (area: { correctOutcomes: number; assessableOutcomes: number }) => area.correctOutcomes / area.assessableOutcomes;
  return [...groups.values()]
    .map((group) => ({ paper: group[0]!.paper, part: group[0]!.part, targetId: group[0]!.languageTargetId, ...evidenceState(group) }))
    .filter((area) => area.state === "needs practice" || area.state === "building")
    .sort((a, b) => Number(a.state === "building") - Number(b.state === "building") || rate(a) - rate(b));
}

export async function getLearnerHome(actor: Actor, requestedFilters: { topic?: string; taskType?: string } = {}): Promise<LearnerHome> {
  if (actor.role !== "learner") throw Object.assign(new Error("Learner access is required."), { code: "FORBIDDEN" });
  const valid = learnerHomeFilterSchema.parse(requestedFilters);
  const rows = await repository.listPublishedSetsForLearner(actor.id);
  const allSets: LearnerPracticeSet[] = rows.map((row) => ({
    ...row,
    paper: row.paper,
    targetIds: row.targetIds as string[],
    submittedAttemptId: row.submittedAttemptId,
    action: (row.openLastSavedAt ? "Resume" : row.submittedAttemptId ? "Review" : "Start") as LearnerPracticeSet["action"],
    lastSavedAt: row.openLastSavedAt ?? undefined,
  }));
  const filters = { topic: valid.topic || undefined, taskType: valid.taskType || undefined, topics: [...new Set(allSets.map((set) => set.topic))], taskTypes: [...new Set(allSets.map((set) => set.taskType))] };
  const sets = allSets.filter((set) => (!filters.topic || set.topic === filters.topic) && (!filters.taskType || set.taskType === filters.taskType));
  const areas = await practiceAreas(actor.id);
  const focus = areas[0];
  if (!focus || !allSets.length) return { allSets, sets, filters, recommendation: undefined };
  const rank = (set: LearnerPracticeSet) => {
    const matching = areas.filter((area) => area.paper === set.paper && area.part === set.part && set.targetIds.includes(area.targetId));
    return matching.some((area) => area.state === "needs practice") ? 0 : matching.length ? 1 : 2;
  };
  const ranked = [...allSets].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, "en-GB")).slice(0, 3);
  const [target] = await repository.getTargetLabels([focus.targetId]);
  const recommendation = { version: recommendationVersion, setIds: ranked.map((set) => set.id), practiceArea: practiceAreaLabel(target, focus.paper, focus.part) };
  await repository.recordRecommendation(actor.id, recommendation.version, recommendation.setIds);
  return { allSets, sets, filters, recommendation };
}

const preparationMessages = {
  SET_NOT_FOUND: "This practice activity is no longer available.",
  SET_RETIRED: "This practice activity is no longer available.",
  OPEN_ATTEMPT_EXISTS: "You already have this practice activity open. Please resume it.",
  MEDIA_UNAVAILABLE: "Essential media is not available. Please retry or choose another activity.",
  MEDIA_AUTHORISATION_FAILED: "Essential media is not available. Please retry or choose another activity.",
  ESSENTIAL_MEDIA_MISSING: "This practice activity is missing essential media.",
} as const;

function learnerOnly(actor: Actor) {
  return actor.role === "learner" ? undefined : { error: { code: "FORBIDDEN" as const, message: "Learner access is required." } };
}

export async function preparePractice(actor: Actor, input: unknown): Promise<PracticeResult<PracticePreparation>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = preparePracticeSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid practice activity." } };
  const { setId } = parsed.data;
  const result = await repository.preparePublishedPractice(actor.id, setId);
  return "error" in result ? { error: { code: result.error, message: preparationMessages[result.error] } } : { data: result };
}

export async function startPractice(actor: Actor, input: unknown): Promise<PracticeResult<PracticeStart>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = startPracticeSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid practice activity." } };
  const { setId } = parsed.data;
  const result = await repository.startPublishedPractice(actor.id, setId);
  return "error" in result ? { error: { code: result.error, message: preparationMessages[result.error] } } : { data: result };
}

export async function getOpenPracticeAttempt(actor: Actor, input: unknown): Promise<PracticeResult<OpenPracticeAttempt>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = z.object({ setId: preparePracticeSchema.shape.setId, attemptId: z.string().uuid() }).strict().safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid practice activity." } };
  const attempt = await repository.getOpenPracticeAttempt(actor.id, parsed.data.setId, parsed.data.attemptId);
  return attempt ? { data: attempt } : { error: { code: "SET_NOT_FOUND", message: "This practice activity is no longer available." } };
}

const playerMessages = {
  ATTEMPT_SCOPE_MISMATCH: "This practice activity is no longer available.",
  ATTEMPT_FINALISED: "This practice activity has already been submitted.",
  ATTEMPT_REVISION_CONFLICT: "Your practice changed elsewhere. Reload the latest version.",
  ITEM_INVALID: "This question is unavailable.",
} as const;
function playerResult<T extends object>(result: T | { error: keyof typeof playerMessages }): PracticeResult<T> {
  return "error" in result ? { error: { code: result.error, message: playerMessages[result.error] } } : { data: result };
}
export async function getPracticePlayer(actor: Actor, input: unknown): Promise<PracticeResult<PracticePlayer>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = practiceAttemptSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid practice activity." } };
  return playerResult<PracticePlayer>(await repository.getPracticePlayer(actor.id, parsed.data.setId, parsed.data.attemptId));
}
export async function savePracticeResponse(actor: Actor, input: unknown): Promise<PracticeResult<{ revision: number }>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Enter a valid answer." } };
  return playerResult(await repository.savePracticeResponse(actor.id, parsed.data));
}
export async function recordPracticePlayback(actor: Actor, input: unknown): Promise<PracticeResult<{ revision: number }>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = playbackSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Replay this audio again." } };
  return playerResult(await repository.recordPracticePlayback(actor.id, parsed.data));
}
export async function getAttemptMedia(actor: Actor, input: unknown) {
  if (actor.role !== "learner") return undefined;
  const parsed = attemptMediaSchema.safeParse(input);
  return parsed.success ? repository.getAttemptMedia(actor.id, parsed.data.setId, parsed.data.attemptId, parsed.data.setVersionId, parsed.data.mediaId, parsed.data.mediaKey) : undefined;
}
export async function submitPracticeAttempt(actor: Actor, input: unknown): Promise<PracticeResult<SubmittedPracticeResult>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = submitAttemptSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Reconnect and submit your practice again." } };
  return playerResult(await repository.submitPracticeAttempt(actor.id, parsed.data));
}
export async function getSubmittedPracticeReview(actor: Actor, input: unknown): Promise<PracticeResult<SubmittedPracticeReview>> {
  const denied = learnerOnly(actor);
  if (denied) return denied;
  const parsed = practiceAttemptSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid practice activity." } };
  const result = await repository.getSubmittedPracticeReview(actor.id, parsed.data.setId, parsed.data.attemptId);
  return "error" in result ? { error: { code: result.error, message: playerMessages[result.error] } } : { data: result };
}
