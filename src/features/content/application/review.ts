import { database } from "@/infrastructure/database/client";
import type { Actor } from "@/features/identity/domain/contracts";
import {
  accessibilityLeakageFindings,
  engineMediaFindings,
  mediaDraftSchema,
  phonePreviewInputSchema,
  plainTextFindings,
  questionDraftSchema,
  reasonInputSchema,
  workflowInputSchema,
  type ContentFindings,
  type MediaDraftInput,
  type QuestionDraftInput,
  type WorkflowInput,
} from "../domain/contracts";
import * as repository from "../infrastructure/repositories";
import { ContentError, contentInput, currentMediaFindings, nonExceptionable, parse, staff, validateReferences, type Transaction } from "./shared";
/* Review lifecycle: validation, submission, exceptions, phone preview, approval and rejection. */
const validateStored = async (
  input: WorkflowInput,
  actor: Actor,
  tx: Transaction,
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
    const associations = await repository.lockQuestionMediaEntries([input.targetId], tx);
    const question = item as Awaited<ReturnType<typeof repository.getQuestion>>;
    const associated = associations.map((entry) => ({ ...entry.media, position: entry.position - 1 }));
    if (associated.some((media) => media.status === "retired"))
      findings.push({ field: "mediaIds", code: "MEDIA_RETIRED", message: "Retired media cannot remain associated with a question draft." });
    if (associated.some((media) => media.paper !== question!.paper || media.part !== question!.part || media.engine !== question!.engine))
       findings.push({ field: "mediaIds", code: "MEDIA_SCOPE_MISMATCH", message: "Media must match the question paper, part and engine." });
    findings.push(...engineMediaFindings(question!.engine, associated));
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
  tx: Transaction,
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
  tx: Transaction,
) =>
  !nonExceptionable(findings) &&
  (!findings.length ||
  repository.hasExceptionForValidation(
    input.kind,
    input.targetId,
    validationResultId,
    tx,
  ));
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
    if (nonExceptionable(findings))
      throw new ContentError(
        "VALIDATION_FAILED",
        "Required learner media and picture-choice labels cannot be excepted.",
        findings,
      );
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
    const currentFindings = await currentMediaFindings(valid, item, tx);
    if (
      nonExceptionable(findings) ||
      nonExceptionable(currentFindings) ||
      !(await accepted(valid, findings, validationResultId, tx))
    )
      throw new ContentError(
        "VALIDATION_FAILED",
        "Resolve findings or record an exception.",
        [...findings, ...currentFindings],
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
    const sourceMediaIds = valid.kind === "question"
      ? (await repository.getQuestionMediaEntries([valid.targetId], tx)).map((entry) => entry.media.id)
      : [];
    const source =
      valid.kind === "question"
        ? questionDraftSchema.parse({
            ...base,
            answerPolicyVersionId: draft.answerPolicyVersionId,
            prompt: draft.prompt,
            options: draft.options,
            postSubmitHint: draft.postSubmitHint ?? undefined,
            mediaIds: sourceMediaIds,
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
