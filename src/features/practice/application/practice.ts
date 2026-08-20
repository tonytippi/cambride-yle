import type { Actor } from "@/features/identity/domain/contracts";
import { z } from "zod";
import { learnerHomeFilterSchema, playbackSchema, preparePracticeSchema, practiceAttemptSchema, responseSchema, startPracticeSchema, type LearnerHome, type LearnerPracticeSet, type OpenPracticeAttempt, type PracticePlayer, type PracticePreparation, type PracticeResult, type PracticeStart, type SubmittedEvidence } from "../domain/contracts";
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
  const parsed = playbackSchema.pick({ setId: true, attemptId: true, mediaId: true }).safeParse(input);
  return parsed.success ? repository.getAttemptMedia(actor.id, parsed.data.setId, parsed.data.attemptId, parsed.data.mediaId) : undefined;
}
