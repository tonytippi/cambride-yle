import { database } from "@/infrastructure/database/client";
import { authorise, IdentityError } from "@/features/identity/application/auth";
import type { Actor } from "@/features/identity/domain/contracts";
import { serverConfig } from "@/shared/config/server";
import {
  accessibilityLeakageFindings,
  composePracticeSetSchema,
  findingsFrom,
  generatedMediaOutputSchema,
  generatedQuestionOutputSchema,
  generationRequestSchema,
  mediaDraftSchema,
  phonePreviewInputSchema,
  plainTextFindings,
  practiceSetWorkflowSchema,
  questionDraftSchema,
  reasonInputSchema,
  workflowInputSchema,
  type ComposePracticeSetInput,
  type ContentFindings,
  type GenerationRequest,
  type MediaDraftInput,
  type QuestionDraftInput,
  type WorkflowInput,
} from "../domain/contracts";
import { generatedProvenance, outputHash } from "../domain/provenance";
import { GatewayError, generate } from "../infrastructure/gateways";
import * as repository from "../infrastructure/repositories";
export class ContentError extends Error {
  readonly code: string;
  readonly findings: { field: string; code: string; message: string }[];
  constructor(
    code: string,
    message: string,
    findings: { field: string; code: string; message: string }[] = [],
  ) {
    super(message);
    this.code = code;
    this.findings = findings;
  }
}
const staff = (actor: Actor) => authorise(actor, ["academic_lead", "admin"]);
/* eslint-disable no-unused-vars */
const parse = <T>(
  schema: {
    safeParse: (
      ...args: [unknown]
    ) =>
      | { success: true; data: T }
      | { success: false; error: Parameters<typeof findingsFrom>[0] };
  },
  input: unknown,
): T => {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ContentError(
      "VALIDATION_FAILED",
      "Check the named validation findings.",
      findingsFrom(result.error),
    );
  return result.data;
};
/* eslint-enable no-unused-vars */
export async function getContentDrafts(actor: Actor) {
  staff(actor);
  return repository.listDrafts();
}
async function validateReferences(
  input: QuestionDraftInput | MediaDraftInput,
  tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
) {
  const refs = await repository.getControlledReferences(input, tx);
  const requested = [
    input.primaryTargetId,
    ...input.supportingTargetIds,
    ...input.topicIds,
  ];
  const findings = requested
    .filter(
      (id) =>
        !refs.targets.some((target) => target.id === id && target.isApproved),
    )
    .map((id) => ({
      field: "targetIds",
      code: "TARGET_NOT_CONTROLLED",
      message: `The selected target ${id} is not approved for controlled use.`,
    }));
  if (!refs.guidance)
    findings.push({
      field: "guidanceId",
      code: "GUIDANCE_NOT_FOUND",
      message: "The selected controlled guidance was not found.",
    });
  else if (
    refs.guidance.paper !== input.paper ||
    refs.guidance.part !== input.part ||
    refs.guidance.engine !== input.engine
  )
    findings.push({
      field: "guidanceId",
      code: "GUIDANCE_SCOPE_MISMATCH",
      message:
        "The selected guidance does not match the draft paper, part and engine.",
    });
  if (
    "answerPolicyVersionId" in input &&
    (!refs.policy ||
      refs.policy.policy.targetId !== input.primaryTargetId ||
      refs.policy.policy.guidanceId !== input.guidanceId ||
      refs.policy.policy.paper !== input.paper ||
      refs.policy.policy.part !== input.part ||
      refs.policy.policy.engine !== input.engine)
  )
    findings.push({
      field: "answerPolicyVersionId",
      code: "ANSWER_POLICY_SCOPE_MISMATCH",
      message: "The selected answer-policy version does not match this draft.",
    });
  if (findings.length)
    throw new ContentError(
      "VALIDATION_FAILED",
      "Check the named validation findings.",
      findings,
    );
}
export async function createManualQuestion(
  actor: Actor,
  input: QuestionDraftInput,
) {
  staff(actor);
  const valid = parse(questionDraftSchema, input);
  return database.transaction(async (tx) => {
    await validateReferences(valid, tx);
    return repository.createQuestion(valid, actor.id, "manual", tx);
  });
}
export async function createManualMedia(actor: Actor, input: MediaDraftInput) {
  staff(actor);
  const valid = parse(mediaDraftSchema, input);
  return database.transaction(async (tx) => {
    await validateReferences(valid, tx);
    return repository.createMedia(valid, actor.id, "manual", tx);
  });
}
export async function reviseQuestion(
  actor: Actor,
  sourceId: string,
  input: QuestionDraftInput,
) {
  staff(actor);
  const valid = parse(questionDraftSchema, input);
  return database.transaction(async (tx) => {
    if (!(await repository.getQuestion(sourceId, tx)))
      throw new ContentError(
        "QUESTION_DRAFT_NOT_FOUND",
        "The question draft was not found.",
      );
    await validateReferences(valid, tx);
    return repository.createQuestion(valid, actor.id, "manual", tx, sourceId);
  });
}
export async function reviseMedia(
  actor: Actor,
  sourceId: string,
  input: MediaDraftInput,
) {
  staff(actor);
  const valid = parse(mediaDraftSchema, input);
  return database.transaction(async (tx) => {
    if (!(await repository.getMedia(sourceId, tx)))
      throw new ContentError(
        "MEDIA_DRAFT_NOT_FOUND",
        "The media draft was not found.",
      );
    await validateReferences(valid, tx);
    return repository.createMedia(valid, actor.id, "manual", tx, sourceId);
  });
}
const contentInput = async (
  input: WorkflowInput,
  tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
) => {
  const item = await repository.getContent(input.kind, input.targetId, tx);
  if (!item)
    throw new ContentError(
      "CONTENT_DRAFT_NOT_FOUND",
      "The content draft was not found.",
    );
  return item;
};
const validateStored = async (
  input: WorkflowInput,
  actor: Actor,
  tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
) => {
  const item = await contentInput(input, tx);
  const draft =
    input.kind === "question"
      ? {
          ...item,
          part: Number(item.part),
          estimatedDurationSeconds: Number(item.estimatedDurationSeconds),
          supportingTargetIds: item.supportingTargetIds as string[],
          topicIds: item.topicIds as string[],
        }
      : {
          ...item,
          part: Number(item.part),
          estimatedDurationSeconds: Number(item.estimatedDurationSeconds),
          supportingTargetIds: item.supportingTargetIds as string[],
          topicIds: item.topicIds as string[],
        };
  const findings: ContentFindings = [];
  try {
    await validateReferences(draft as QuestionDraftInput | MediaDraftInput, tx);
  } catch (error) {
    if (error instanceof ContentError) findings.push(...error.findings);
    else throw error;
  }
  if (input.kind === "question") {
    const question = item as Awaited<ReturnType<typeof repository.getQuestion>>;
    if (
      !(question!.options as unknown[]).length ||
      !question!.answerPolicyVersionId
    )
      findings.push({
        field: "answerPolicyVersionId",
        code: "ANSWER_KEY_REQUIRED",
        message: "An answer policy is required.",
      });
  }
  if (
    input.kind === "media" &&
    !(
      item as Awaited<ReturnType<typeof repository.getMedia>>
    )?.description.trim()
  )
    findings.push({
      field: "description",
      code: "MEDIA_REQUIRED",
      message: "Required media details are missing.",
    });
  if (!item.provenance || !item.accessibilityMetadata)
    findings.push({
      field: "provenance",
      code: "PROVENANCE_OR_ACCESSIBILITY_REQUIRED",
      message: "Provenance and accessibility metadata are required.",
    });
  if (input.kind === "question") {
    const question = item as Awaited<ReturnType<typeof repository.getQuestion>>;
    findings.push(
      ...plainTextFindings("prompt", question?.prompt),
      ...(Array.isArray(question?.options)
        ? question.options.flatMap((option, index) =>
            plainTextFindings(`options.${index}`, option),
          )
        : [
            {
              field: "options",
              code: "STAFF_TEXT_INVALID",
              message: "Question options must be plain text.",
            },
          ]),
      ...accessibilityLeakageFindings(
        (item.accessibilityMetadata as { altText?: unknown })?.altText,
        question?.options,
      ),
    );
  }
  if (input.kind === "media")
    findings.push(
      ...plainTextFindings(
        "description",
        (item as Awaited<ReturnType<typeof repository.getMedia>>)?.description,
      ),
    );
  const metadata = item.accessibilityMetadata as { altText?: unknown };
  const provenance = item.provenance as {
    source?: unknown;
    rightsReference?: unknown;
  };
  findings.push(
    ...plainTextFindings("accessibilityMetadata.altText", metadata?.altText),
    ...plainTextFindings("provenance.source", provenance?.source),
    ...plainTextFindings(
      "provenance.rightsReference",
      provenance?.rightsReference,
    ),
  );
  const validationResultId = await repository.recordValidation(
    input.kind,
    input.targetId,
    actor.id,
    findings,
    tx,
  );
  return { item, findings, validationResultId };
};
const unresolved = async (
  input: WorkflowInput,
  tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
) => {
  const result = await repository.latestValidation(
    input.kind,
    input.targetId,
    tx,
  );
  if (!result)
    throw new ContentError(
      "VALIDATION_REQUIRED",
      "Run validation before this review decision.",
    );
  return {
    findings: result.findings as ContentFindings,
    validationResultId: result.id,
  };
};
const accepted = async (
  input: WorkflowInput,
  findings: ContentFindings,
  validationResultId: string,
  tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
) =>
  !findings.length ||
  repository.hasExceptionForValidation(
    input.kind,
    input.targetId,
    validationResultId,
    tx,
  );
export async function validateContent(actor: Actor, input: WorkflowInput) {
  staff(actor);
  const valid = parse(workflowInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "draft")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only draft content can be validated.",
      );
    return validateStored(valid, actor, tx);
  });
}
export async function submitForReview(actor: Actor, input: WorkflowInput) {
  staff(actor);
  const valid = parse(workflowInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "draft")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only draft content can be submitted for review.",
      );
    const { findings, validationResultId } = await unresolved(valid, tx);
    if (!(await accepted(valid, findings, validationResultId, tx)))
      throw new ContentError(
        "VALIDATION_FAILED",
        "Resolve findings or record an exception.",
        findings,
      );
    await repository.recordReview(
      valid.kind,
      valid.targetId,
      actor.id,
      "submitted",
      findings,
      tx,
      validationResultId,
    );
    await repository.updateStatus(valid.kind, valid.targetId, "in_review", tx);
    await repository.recordAudit(
      "CONTENT_SUBMITTED_FOR_REVIEW",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
export async function acceptException(
  actor: Actor,
  input: WorkflowInput & { reason: string },
) {
  staff(actor);
  const valid = parse(reasonInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "draft" && item.status !== "in_review")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only draft or in-review content can accept an exception.",
      );
    const { findings, validationResultId } = await unresolved(valid, tx);
    if (!findings.length)
      throw new ContentError(
        "NO_FINDINGS_TO_EXCEPT",
        "There are no findings to accept.",
      );
    await repository.recordReview(
      valid.kind,
      valid.targetId,
      actor.id,
      "exception",
      findings,
      tx,
      validationResultId,
      valid.reason,
    );
    await repository.recordAudit(
      "CONTENT_EXCEPTION_ACCEPTED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
export async function recordPhonePreview(
  actor: Actor,
  input: WorkflowInput & { viewportWidth: 375; successful: true },
) {
  staff(actor);
  const valid = parse(phonePreviewInputSchema, input);
  if (valid.kind !== "media")
    throw new ContentError(
      "PHONE_PREVIEW_MEDIA_ONLY",
      "Phone preview applies only to image media.",
    );
  return database.transaction(async (tx) => {
    const item = (await contentInput(valid, tx)) as Awaited<
      ReturnType<typeof repository.getMedia>
    >;
    if (item!.status !== "in_review")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only image media in review can record phone preview evidence.",
      );
    if (item.mediaType !== "image")
      throw new ContentError(
        "PHONE_PREVIEW_MEDIA_ONLY",
        "Phone preview applies only to image media.",
      );
    await repository.recordPhonePreview(valid.targetId, actor.id, tx);
    await repository.recordAudit(
      "CONTENT_PHONE_PREVIEW_CONFIRMED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
export async function approveContent(actor: Actor, input: WorkflowInput) {
  staff(actor);
  const valid = parse(workflowInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "in_review")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only content in review can be approved.",
      );
    if (await repository.hasRejection(valid.kind, valid.targetId, tx))
      throw new ContentError(
        "CONTENT_REJECTED",
        "Rejected content cannot be approved; review its linked draft revision.",
      );
    const { findings, validationResultId } = await unresolved(valid, tx);
    if (!(await accepted(valid, findings, validationResultId, tx)))
      throw new ContentError(
        "VALIDATION_FAILED",
        "Resolve findings or record an exception.",
        findings,
      );
    if (
      valid.kind === "media" &&
      (item as Awaited<ReturnType<typeof repository.getMedia>>)?.mediaType ===
        "image" &&
      !(await repository.hasPhonePreview(valid.targetId, tx))
    )
      throw new ContentError(
        "PHONE_PREVIEW_REQUIRED",
        "Record a successful 375px phone preview before approval.",
      );
    await repository.recordReview(
      valid.kind,
      valid.targetId,
      actor.id,
      "approved",
      findings,
      tx,
      validationResultId,
    );
    await repository.updateStatus(valid.kind, valid.targetId, "approved", tx);
    await repository.recordAudit(
      "CONTENT_APPROVED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
export async function publishContent(actor: Actor, input: WorkflowInput) {
  staff(actor);
  const valid = parse(workflowInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "approved")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only approved content can be published.",
      );
    await repository.updateStatus(valid.kind, valid.targetId, "published", tx);
    await repository.recordAudit(
      "CONTENT_PUBLISHED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
export async function retireContent(actor: Actor, input: WorkflowInput) {
  staff(actor);
  const valid = parse(workflowInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "published")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only published content can be retired.",
      );
    await repository.updateStatus(valid.kind, valid.targetId, "retired", tx);
    await repository.recordAudit(
      "CONTENT_RETIRED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
export async function publishPracticeSet(
  actor: Actor,
  input: ComposePracticeSetInput,
) {
  staff(actor);
  const valid = parse(composePracticeSetSchema, input);
  return database.transaction(async (tx) => {
    const questions = await repository.lockQuestions(valid.questionIds, tx);
    const mediaIds = valid.mediaByQuestion.flatMap((entry) => entry.mediaIds);
    const media = await repository.lockMediaVersions(mediaIds, tx);
    const findings: ContentFindings = [];
    const selectedQuestionIds = new Set(valid.questionIds);
    const mappedQuestionIds = new Set<string>();
    for (const entry of valid.mediaByQuestion) {
      if (!selectedQuestionIds.has(entry.questionId))
        findings.push({
          field: "mediaByQuestion",
          code: "MEDIA_MAPPING_QUESTION_NOT_SELECTED",
          message: "Media mappings must reference a selected question.",
        });
      if (mappedQuestionIds.has(entry.questionId))
        findings.push({
          field: "mediaByQuestion",
          code: "MEDIA_MAPPING_DUPLICATE",
          message: "Each selected question may have one media mapping.",
        });
      mappedQuestionIds.add(entry.questionId);
    }
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
      media.length !== new Set(mediaIds).size ||
      media.some((item) => item.status !== "published")
    )
      findings.push({
        field: "mediaByQuestion",
        code: "MEDIA_NOT_PUBLISHED",
        message: "Every selected media version must be published.",
      });
    const questionsById = new Map(
      questions.map((question) => [question.id, question]),
    );
    const mediaById = new Map(media.map((item) => [item.id, item]));
    for (const entry of valid.mediaByQuestion) {
      const question = questionsById.get(entry.questionId);
      for (const mediaId of entry.mediaIds) {
        const item = mediaById.get(mediaId);
        if (
          question &&
          item &&
          (item.paper !== question.paper ||
            item.part !== question.part ||
            item.engine !== question.engine)
        )
          findings.push({
            field: "mediaByQuestion",
            code: "MEDIA_SCOPE_MISMATCH",
            message: "Media must match its question paper, part and engine.",
          });
      }
    }
    for (const question of questions)
      if (
        (question.engine === "audio_picture_choice" ||
          question.engine === "audio_note_taking") &&
        !valid.mediaByQuestion
          .find((entry) => entry.questionId === question.id)
          ?.mediaIds.some(
            (mediaId) => mediaById.get(mediaId)?.mediaType === "audio",
          )
      )
        findings.push({
          field: "mediaByQuestion",
          code: "AUDIO_MEDIA_REQUIRED",
          message:
            "This audio engine requires an associated published audio version.",
        });
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
        mediaByQuestion: new Map(
          valid.mediaByQuestion.map((entry) => [
            entry.questionId,
            entry.mediaIds
              .map((mediaId) => mediaById.get(mediaId))
              .filter((media): media is NonNullable<typeof media> => Boolean(media)),
          ]),
        ),
        actorId: actor.id,
      },
      tx,
    );
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
    const set = await repository.getPracticeSet(valid.practiceSetId, tx);
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
export async function rejectContent(
  actor: Actor,
  input: WorkflowInput & { reason: string },
) {
  staff(actor);
  const valid = parse(reasonInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "in_review")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only content in review can be rejected.",
      );
    const { findings, validationResultId } = await unresolved(valid, tx);
    await repository.recordReview(
      valid.kind,
      valid.targetId,
      actor.id,
      "rejected",
      findings,
      tx,
      validationResultId,
      valid.reason,
    );
    const draft = item as Record<string, unknown>;
    const base = {
      paper: draft.paper,
      part: Number(draft.part),
      engine: draft.engine,
      primaryTargetId: draft.primaryTargetId,
      supportingTargetIds: draft.supportingTargetIds,
      topicIds: draft.topicIds,
      guidanceId: draft.guidanceId,
      estimatedDurationSeconds: Number(draft.estimatedDurationSeconds),
      accessibilityMetadata: draft.accessibilityMetadata,
      provenance: draft.provenance,
    };
    const source =
      valid.kind === "question"
        ? questionDraftSchema.parse({
            ...base,
            answerPolicyVersionId: draft.answerPolicyVersionId,
            prompt: draft.prompt,
            options: draft.options,
            postSubmitHint: draft.postSubmitHint ?? undefined,
          })
        : mediaDraftSchema.parse({
            ...base,
            mediaType: draft.mediaType,
            previewUrl: draft.previewUrl ?? undefined,
            description: draft.description,
          });
    const revisionId =
      valid.kind === "question"
        ? await repository.createQuestion(
            source as QuestionDraftInput,
            actor.id,
            item.origin,
            tx,
            valid.targetId,
          )
        : await repository.createMedia(
            source as MediaDraftInput,
            actor.id,
            item.origin,
            tx,
            valid.targetId,
          );
    await repository.recordAudit(
      "CONTENT_REJECTED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
    return revisionId;
  });
}
export async function requestAiDraft(
  actor: Actor,
  input: GenerationRequest,
  sourceId?: string,
) {
  staff(actor);
  const request = parse(generationRequestSchema, input);
  const kind = request.kind === "text" ? "question" : "media";
  if (!serverConfig.AI_DRAFT_PROVIDER_GATE_CLOSED) {
    await database.transaction((tx) =>
      repository.recordAudit(
        "AI_DRAFT_REQUEST_BLOCKED_GATE_OPEN",
        kind,
        request.draft.primaryTargetId,
        actor.id,
        tx,
      ),
    );
    throw new ContentError(
      "AI_DRAFT_PROVIDER_GATE_OPEN",
      "AI draft generation is unavailable until the provider gate is closed.",
    );
  }
  try {
    await database.transaction(async (tx) => {
      await validateReferences(request.draft, tx);
      if (sourceId) {
        const exists =
          request.kind === "text"
            ? await repository.getQuestion(sourceId, tx)
            : await repository.getMedia(sourceId, tx);
        if (!exists)
          throw new ContentError(
            "CONTENT_DRAFT_NOT_FOUND",
            "The source draft was not found.",
          );
      }
    });
    let result;
    try {
      result = await generate(request);
    } catch (error) {
      if (error instanceof GatewayError)
        throw new ContentError(error.code, error.message);
      throw error;
    }
    const output =
      "answerPolicyVersionId" in request.draft
        ? parse(generatedQuestionOutputSchema, result.output)
        : parse(generatedMediaOutputSchema, result.output);
    return await database.transaction(async (tx) => {
      if (request.kind === "text") {
        const generated = {
          ...request.draft,
          ...(output as { prompt: string; options: string[] }),
          provenance: generatedProvenance(
            request,
            result.endpoint,
            result.model,
          ),
        };
        await validateReferences(generated, tx);
        const targetId = await repository.createQuestion(
          generated,
          actor.id,
          "generated",
          tx,
          sourceId,
        );
        await repository.recordGeneration(
          kind,
          targetId,
          request.kind,
          result.endpoint,
          result.model,
          { staffPrompt: request.staffPrompt },
          request.permittedReferences,
          outputHash(result.output),
          tx,
        );
        await repository.recordAudit(
          "AI_DRAFT_REQUEST_SUCCEEDED",
          kind,
          targetId,
          actor.id,
          tx,
        );
        return targetId;
      }
      const generated = {
        ...request.draft,
        ...(output as { description: string; previewUrl?: string }),
        provenance: generatedProvenance(request, result.endpoint, result.model),
      };
      await validateReferences(generated, tx);
      const targetId = await repository.createMedia(
        generated,
        actor.id,
        "generated",
        tx,
        sourceId,
      );
      await repository.recordGeneration(
        kind,
        targetId,
        request.kind,
        result.endpoint,
        result.model,
        { staffPrompt: request.staffPrompt },
        request.permittedReferences,
        outputHash(result.output),
        tx,
      );
      await repository.recordAudit(
        "AI_DRAFT_REQUEST_SUCCEEDED",
        kind,
        targetId,
        actor.id,
        tx,
      );
      return targetId;
    });
  } catch (error) {
    try {
      await database.transaction((tx) =>
        repository.recordAudit(
          "AI_DRAFT_REQUEST_FAILED",
          kind,
          request.draft.primaryTargetId,
          actor.id,
          tx,
        ),
      );
    } catch {
      /* Preserve the original downstream failure if independent audit persistence also fails. */
    }
    throw error;
  }
}
export { IdentityError };
