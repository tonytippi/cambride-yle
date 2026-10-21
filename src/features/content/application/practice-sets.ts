import { database } from "@/infrastructure/database/client";
import type { Actor } from "@/features/identity/domain/contracts";
import {
  composePracticeSetSchema,
  engineMediaFindings,
  normaliseChoiceLabel,
  practiceSetWorkflowSchema,
  type ComposePracticeSetInput,
  type ContentFindings,
  type QuestionDraftInput,
} from "../domain/contracts";
import * as repository from "../infrastructure/repositories";
import { ContentError, parse, staff, validateReferences } from "./shared";
/* Practice-set lifecycle: draft, review, approval, immutable publication and retirement. */
export async function createPracticeSetDraft(
  actor: Actor,
  input: ComposePracticeSetInput,
) {
  staff(actor);
  const valid = parse(composePracticeSetSchema, input);
  return database.transaction(async (tx) => {
    const questions = await repository.lockQuestions(valid.questionIds, tx);
    if (questions.length !== valid.questionIds.length)
      throw new ContentError("VALIDATION_FAILED", "Check the named validation findings.", [{ field: "questionIds", code: "QUESTION_NOT_FOUND", message: "Every selected question version must exist." }]);
    const paperParts = new Set(questions.map((question) => `${question.paper}:${question.part}`));
    const duration = questions.reduce((total, question) => total + Number(question.estimatedDurationSeconds), 0);
    const objectives = new Set(questions.map((question) => question.primaryTargetId));
    const findings: ContentFindings = [
      ...(questions.some((question) => question.status !== "published") ? [{ field: "questionIds", code: "QUESTION_NOT_PUBLISHED", message: "Every selected question must be published before drafting a practice set." }] : []),
      ...(paperParts.size === 1 ? [] : [{ field: "questionIds", code: "PAPER_PART_MISMATCH", message: "A set must use one paper and part." }]),
      ...(duration >= 300 && duration <= 600 ? [] : [{ field: "questionIds", code: "DURATION_OUT_OF_RANGE", message: "A set must take five to ten minutes." }]),
      ...(objectives.size >= 1 && objectives.size <= 2 ? [] : [{ field: "questionIds", code: "PRIMARY_OBJECTIVES_INVALID", message: "A set must have one or two distinct primary objectives." }]),
    ];
    if (findings.length) throw new ContentError("VALIDATION_FAILED", "Check the named validation findings.", findings);
    const setId = await repository.createPracticeSetDraft({ title: valid.title, questions, actorId: actor.id }, tx);
    await repository.recordPracticeSetAudit("PRACTICE_SET_DRAFT_CREATED", setId, actor.id, tx);
    return setId;
  });
}
export async function submitPracticeSetForReview(actor: Actor, input: { practiceSetId: string }) {
  staff(actor);
  const valid = parse(practiceSetWorkflowSchema, input);
  return database.transaction(async (tx) => {
    const set = await repository.lockPracticeSet(valid.practiceSetId, tx);
    if (!set) throw new ContentError("PRACTICE_SET_NOT_FOUND", "The practice set was not found.");
    if (set.status !== "draft") throw new ContentError("CONTENT_TRANSITION_CONFLICT", "Only draft practice sets can be submitted for review.");
    await repository.recordPracticeSetReview(set.id, actor.id, "submitted", [], tx);
    await repository.updatePracticeSetStatus(set.id, "in_review", tx);
    await repository.recordPracticeSetAudit("PRACTICE_SET_SUBMITTED", set.id, actor.id, tx);
  });
}
export async function approvePracticeSet(actor: Actor, input: { practiceSetId: string }) {
  staff(actor);
  const valid = parse(practiceSetWorkflowSchema, input);
  return database.transaction(async (tx) => {
    const set = await repository.lockPracticeSet(valid.practiceSetId, tx);
    if (!set) throw new ContentError("PRACTICE_SET_NOT_FOUND", "The practice set was not found.");
    if (set.status !== "in_review") throw new ContentError("CONTENT_TRANSITION_CONFLICT", "Only practice sets in review can be approved.");
    await repository.recordPracticeSetReview(set.id, actor.id, "approved", [], tx);
    await repository.updatePracticeSetStatus(set.id, "approved", tx);
    await repository.recordPracticeSetAudit("PRACTICE_SET_APPROVED", set.id, actor.id, tx);
  });
}
export async function publishPracticeSet(
  actor: Actor,
  input: { practiceSetId: string } | ComposePracticeSetInput,
) {
  staff(actor);
  if ("questionIds" in input)
    throw new ContentError("CONTENT_TRANSITION_CONFLICT", "Create a draft, submit it for review, approve it, then publish it.");
  const lifecycle = parse(practiceSetWorkflowSchema, input);
  return database.transaction(async (tx) => {
    const set = await repository.lockPracticeSet(lifecycle.practiceSetId, tx);
    if (!set) throw new ContentError("PRACTICE_SET_NOT_FOUND", "The practice set was not found.");
    if (set.status !== "approved") throw new ContentError("CONTENT_TRANSITION_CONFLICT", "Only approved practice sets can be published.");
    await repository.beginPracticeSetPublication(set.id, tx);
    const questions = await repository.lockPracticeSetQuestions(set.id, tx);
    const questionIds = questions.map((question) => question.id);
    const valid = { title: set.title, questionIds };
    const entries = await repository.lockQuestionMediaEntries(valid.questionIds, tx);
    const media = entries.map((entry) => entry.media);
    const findings: ContentFindings = [];
    const selectedQuestionIds = new Set(valid.questionIds);
    if (selectedQuestionIds.size !== valid.questionIds.length)
      findings.push({
        field: "questionIds",
        code: "QUESTION_MAPPING_DUPLICATE",
        message: "A question version may only appear once in a practice set.",
      });
    if (
      questions.length !== selectedQuestionIds.size ||
      questions.some((question) => question.status !== "published")
    )
      findings.push({
        field: "questionIds",
        code: "QUESTION_NOT_PUBLISHED",
        message: "Every selected question must be published.",
      });
    if (
      media.some((item) => item.status !== "published")
    )
      findings.push({
        field: "mediaIds",
        code: "MEDIA_NOT_PUBLISHED",
        message: "Every selected media version must be published.",
      });
    const questionsById = new Map(
      questions.map((question) => [question.id, question]),
    );
    const mediaByQuestion = new Map<string, typeof media>();
    for (const entry of entries) {
      const question = questionsById.get(entry.questionVersionId);
      const item = entry.media;
      if (question && item) {
        const mapped = mediaByQuestion.get(question.id) ?? [];
        mapped.push(item);
        mediaByQuestion.set(question.id, mapped);
        if (
          (item.paper !== question.paper ||
            item.part !== question.part ||
            item.engine !== question.engine)
        )
          findings.push({
            field: "mediaIds",
            code: "MEDIA_SCOPE_MISMATCH",
            message: "Media must match its question paper, part and engine.",
          });
      }
    }
    for (const question of questions) {
      const questionMedia = mediaByQuestion.get(question.id) ?? [];
      findings.push(...engineMediaFindings(question.engine, questionMedia.map((item, position) => ({ ...item, position }))));
      const draft = {
        ...question,
        part: Number(question.part),
        estimatedDurationSeconds: Number(question.estimatedDurationSeconds),
        supportingTargetIds: question.supportingTargetIds as string[],
        topicIds: question.topicIds as string[],
        mediaIds: undefined,
      } as QuestionDraftInput;
      try {
        await validateReferences(draft, tx);
      } catch (error) {
        if (error instanceof ContentError) findings.push(...error.findings);
        else throw error;
      }
      const references = await repository.getControlledReferences(draft, tx);
      if (question.engine === "audio_picture_choice" && references.policy?.version) {
        const labels = questionMedia
          .filter((item) => item.mediaType === "image")
          .map((item) => (item.accessibilityMetadata as { choiceLabel?: unknown } | null)?.choiceLabel)
          .filter((label): label is string => typeof label === "string")
          .map(normaliseChoiceLabel);
        const answers = [references.policy.version.canonicalAnswer, ...(references.policy.version.acceptedAnswers as unknown[])];
        if (references.policy.version.inputKind !== "choice" || answers.some((answer) => typeof answer !== "string" || !labels.includes(normaliseChoiceLabel(answer))))
          findings.push({ field: "mediaIds", code: "CHOICE_LABEL_POLICY_MISMATCH", message: "Picture-choice labels must include every answer accepted by the selected policy." });
      }
    }
    const paperParts = new Set(
      questions.map((question) => `${question.paper}:${question.part}`),
    );
    const duration = questions.reduce(
      (total, question) => total + Number(question.estimatedDurationSeconds),
      0,
    );
    const objectives = new Set(
      questions.map((question) => question.primaryTargetId),
    );
    if (paperParts.size !== 1)
      findings.push({
        field: "questionIds",
        code: "PAPER_PART_MISMATCH",
        message: "A set must use one paper and part.",
      });
    if (duration < 300 || duration > 600)
      findings.push({
        field: "questionIds",
        code: "DURATION_OUT_OF_RANGE",
        message: "A set must take five to ten minutes.",
      });
    if (objectives.size < 1 || objectives.size > 2)
      findings.push({
        field: "questionIds",
        code: "PRIMARY_OBJECTIVES_INVALID",
        message: "A set must have one or two distinct primary objectives.",
      });
    if (findings.length)
      throw new ContentError(
        "VALIDATION_FAILED",
        "Check the named validation findings.",
        findings,
      );
    const setId = await repository.createPublishedPracticeSet(
      {
        questions,
        mediaByQuestion,
        actorId: actor.id,
        title: valid.title,
        practiceSetId: set.id,
      },
      tx,
    );
    await repository.updatePracticeSetStatus(set.id, "published", tx);
    await repository.recordPracticeSetAudit(
      "PRACTICE_SET_PUBLISHED",
      setId,
      actor.id,
      tx,
    );
    return setId;
  });
}
export async function retirePracticeSet(
  actor: Actor,
  input: { practiceSetId: string },
) {
  staff(actor);
  const valid = parse(practiceSetWorkflowSchema, input);
  return database.transaction(async (tx) => {
    const set = await repository.lockPracticeSet(valid.practiceSetId, tx);
    if (!set)
      throw new ContentError(
        "PRACTICE_SET_NOT_FOUND",
        "The practice set was not found.",
      );
    if (set.status !== "published")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only published practice sets can be retired.",
      );
    await repository.retirePracticeSet(set.id, tx);
    await repository.recordPracticeSetAudit(
      "PRACTICE_SET_RETIRED",
      set.id,
      actor.id,
      tx,
    );
  });
}
