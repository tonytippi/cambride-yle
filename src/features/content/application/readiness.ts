import type { Actor } from "@/features/identity/domain/contracts";
import * as repository from "../infrastructure/repositories";
import { staff } from "./shared";
/* Pilot readiness: proves each engine has a composable published set per topic and task type. */
type ReadinessCandidate = {
  question: {
    id: string;
    engine: "picture_true_false" | "picture_yes_no" | "audio_picture_choice" | "audio_note_taking" | "word_bank_cloze";
    paper: "listening" | "reading_writing";
    part: string;
    primaryTargetId: string;
    supportingTargetIds: unknown;
    topicIds: unknown;
    estimatedDurationSeconds: string;
  };
  media: { mediaType: string; status: string } | null;
  guidance: { id: string; topic: string; taskFormat: string };
};
type ReadinessQuestion = Omit<ReadinessCandidate["question"], "estimatedDurationSeconds" | "supportingTargetIds" | "topicIds"> & {
  estimatedDurationSeconds: number;
  supportingTargetIds: string[];
  topicIds: string[];
  topic: string;
  taskType: string;
  guidanceId: string;
  media: { mediaType: string; status: string }[];
  mediaEligible: boolean;
};
const audioEngines = new Set(["audio_picture_choice", "audio_note_taking"]);
const compositionFor = (questions: ReadinessQuestion[], limitObjectives: boolean) => {
  const states = new Map<string, ReadinessQuestion[]>();
  states.set("0:", []);
  for (const question of questions) {
    for (const chosen of [...states.values()]) {
      const duration = chosen.reduce((total, item) => total + item.estimatedDurationSeconds, 0) + question.estimatedDurationSeconds;
      const objectives = [...new Set([...chosen.map((item) => item.primaryTargetId), question.primaryTargetId])].sort();
      if (duration > 600 || (limitObjectives && objectives.length > 2)) continue;
      const key = `${duration}:${objectives.join(",")}`;
      if (!states.has(key)) states.set(key, [...chosen, question]);
    }
  }
  return [...states.values()].find((chosen) => {
    const duration = chosen.reduce((total, item) => total + item.estimatedDurationSeconds, 0);
    return duration >= 300 && duration <= 600;
  });
};
export const buildContentReadiness = (candidates: ReadinessCandidate[], targetCategories: ReadonlyMap<string, string> = new Map()) => {
  const questions = new Map<string, ReadinessQuestion>();
  for (const { question, media, guidance } of candidates) {
    const current = questions.get(question.id) ?? {
      ...question,
      estimatedDurationSeconds: Number(question.estimatedDurationSeconds),
      supportingTargetIds: question.supportingTargetIds as string[],
      topicIds: question.topicIds as string[],
      guidanceId: guidance.id,
      topic: guidance.topic,
      taskType: guidance.taskFormat,
      media: [],
      mediaEligible: true,
    };
    if (media) current.media.push(media);
    questions.set(question.id, current);
  }
  for (const question of questions.values())
    question.mediaEligible = question.media.every((media) => media.status === "published") &&
      (!audioEngines.has(question.engine) || question.media.some((media) => media.mediaType === "audio" && media.status === "published"));
  const groups = new Map<string, { topicTargetId: string | null; questions: ReadinessQuestion[] }>();
  for (const question of questions.values())
    for (const topicTargetId of question.topicIds.length ? [...new Set(question.topicIds)] : [null]) {
      const key = `${question.engine}:${question.paper}:${question.part}:${question.guidanceId}:${topicTargetId ?? ""}`;
      const group = groups.get(key) ?? { topicTargetId, questions: [] };
      group.questions.push(question);
      groups.set(key, group);
    }
  const targetsIn = (group: ReadinessQuestion[], category: "vocabulary" | "grammar" | "other") => [...new Set(group.flatMap((candidate) => [candidate.primaryTargetId, ...candidate.supportingTargetIds]))]
    .filter((id) => {
      const current = targetCategories.get(id);
      return category === "other" ? current !== "vocabulary" && current !== "grammar" : current === category;
    });
  const coverage = [...groups.values()].map(({ topicTargetId, questions: group }) => {
    const [question] = group;
    const pool = group.filter((candidate) => candidate.mediaEligible);
    const proof = compositionFor(pool, true);
    const durationProof = proof ? undefined : compositionFor(pool, false);
    const missingAudio = audioEngines.has(question.engine) && group.some((candidate) => !candidate.media.some((media) => media.mediaType === "audio" && media.status === "published"));
    const unpublishedMedia = group.some((candidate) => candidate.media.some((media) => media.status !== "published"));
    const totalDuration = pool.reduce((total, candidate) => total + candidate.estimatedDurationSeconds, 0);
    const gaps = [
      ...(missingAudio ? ["AUDIO_MEDIA_REQUIRED"] : []),
      ...(!missingAudio && unpublishedMedia ? ["ASSOCIATED_MEDIA_NOT_PUBLISHED"] : []),
      ...(!proof && pool.length ? durationProof ? ["PRIMARY_OBJECTIVES_INVALID"] : [totalDuration < 300 ? "DURATION_TOO_SHORT" : "DURATION_OUT_OF_RANGE"] : []),
      ...(!pool.length && !missingAudio && !unpublishedMedia ? ["NO_ELIGIBLE_QUESTION"] : []),
      ...(topicTargetId ? [] : ["TOPIC_NOT_SELECTED"]),
    ];
    return {
      engine: question.engine,
      paper: question.paper,
      part: question.part,
      guidanceId: question.guidanceId,
      topic: question.topic,
      taskType: question.taskType,
      topicTargetId,
      vocabularyTargetIds: targetsIn(group, "vocabulary"),
      grammarTargetIds: targetsIn(group, "grammar"),
      otherTargetIds: targetsIn(group, "other"),
      estimatedDurationSeconds: group.reduce((total, candidate) => total + candidate.estimatedDurationSeconds, 0),
      mediaEligible: pool.length === group.length,
      composition: proof && { questionIds: proof.map((item) => item.id), durationSeconds: proof.reduce((total, item) => total + item.estimatedDurationSeconds, 0), primaryTargetIds: [...new Set(proof.map((item) => item.primaryTargetId))] },
      gaps,
    };
  });
  const covers = (item: (typeof coverage)[number], engine: string) => item.engine === engine && !!item.composition && !!item.topicTargetId;
  return { coverage, engines: (awaitableEngines as readonly string[]).map((engine) => ({ engine, covered: coverage.some((item) => covers(item, engine)), gaps: coverage.some((item) => covers(item, engine)) ? [] : coverage.some((item) => item.engine === engine) ? ["NO_COMPOSABLE_TOPIC_TASK_TYPE"] : ["NO_PUBLISHED_QUESTION"] })) };
};
const awaitableEngines = ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"] as const;
export async function getContentReadiness(actor: Actor) {
  staff(actor);
  const [candidates, categories] = await Promise.all([repository.getReadinessCandidates(), repository.getReadinessTargetCategories()]);
  return buildContentReadiness(candidates, new Map(categories.map((target) => [target.id, target.category])));
}
