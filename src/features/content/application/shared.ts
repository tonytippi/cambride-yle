import { database } from "@/infrastructure/database/client";
import { z } from "zod";
import { authorise } from "@/features/identity/application/auth";
import type { Actor } from "@/features/identity/domain/contracts";
import {
  engineMediaFindings,
  findingsFrom,
  noteTakingOptionFindings,
  type ContentFindings,
  type MediaDraftInput,
  type QuestionDraftInput,
  type WorkflowInput,
} from "../domain/contracts";
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
export const staff = (actor: Actor) => authorise(actor, ["academic_lead", "admin"]);
export const draftId = (value: string, code: "QUESTION_DRAFT_NOT_FOUND" | "MEDIA_DRAFT_NOT_FOUND" | "CONTENT_DRAFT_NOT_FOUND") => {
  if (!z.uuid().safeParse(value).success)
    throw new ContentError(code, "The source draft was not found.");
  return value;
};
/* eslint-disable no-unused-vars */
export const parse = <T>(
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
export type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
/* Controlled-reference and template checks shared by drafting, AI generation and publication. */
export async function validateReferences(
  input: QuestionDraftInput | MediaDraftInput,
  tx: Transaction,
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
  if (refs.guidance && "prompt" in input) {
    const words = input.prompt ? input.prompt.trim().split(/\s+/).filter(Boolean).length : 0;
    if (words > refs.guidance.maxWords)
      findings.push({ field: "prompt", code: "TEMPLATE_MAX_WORDS_EXCEEDED", message: "The prompt exceeds the selected guidance word limit." });
    if (input.options.length > refs.guidance.maxOptions)
      findings.push({ field: "options", code: "TEMPLATE_MAX_OPTIONS_EXCEEDED", message: "The options exceed the selected guidance option limit." });
  }
  if (refs.policy?.version && "options" in input)
    findings.push(...noteTakingOptionFindings(input.engine, input.options, [refs.policy.version.canonicalAnswer, ...(refs.policy.version.acceptedAnswers as unknown[])]));
  if (findings.length)
    throw new ContentError(
      "VALIDATION_FAILED",
      "Check the named validation findings.",
      findings,
    );
}
export async function validateQuestionMedia(
  input: QuestionDraftInput,
  tx: Transaction,
) {
  if (!input.mediaIds?.length) {
    const findings = engineMediaFindings(input.engine, []);
    if (findings.length) throw new ContentError("VALIDATION_FAILED", "Check the named validation findings.", findings);
    return;
  }
  const media = await repository.lockCompatibleMediaForQuestion(input, tx);
  const findings: ContentFindings = [];
  if (media.length !== input.mediaIds.length)
    findings.push({ field: "mediaIds", code: "MEDIA_NOT_FOUND", message: "Every selected media version must exist." });
  for (const item of media)
    if (item.paper !== input.paper || item.part !== String(input.part) || item.engine !== input.engine)
      findings.push({ field: "mediaIds", code: "MEDIA_SCOPE_MISMATCH", message: "Media must match the question paper, part and engine." });
    else if (item.status === "retired")
       findings.push({ field: "mediaIds", code: "MEDIA_RETIRED", message: "Retired media cannot be associated with a question draft." });
  findings.push(...engineMediaFindings(input.engine, media.map((item) => ({ ...item, position: input.mediaIds!.indexOf(item.id) }))));
  if (findings.length) throw new ContentError("VALIDATION_FAILED", "Check the named validation findings.", findings);
}
/* Workflow helpers shared by the review and publication use cases. */
export const contentInput = async (
  input: WorkflowInput,
  tx: Transaction,
) => {
  const item = await repository.getContent(input.kind, input.targetId, tx);
  if (!item)
    throw new ContentError(
      "CONTENT_DRAFT_NOT_FOUND",
      "The content draft was not found.",
    );
  return item;
};
export const nonExceptionable = (findings: ContentFindings) =>
  findings.some(
    (finding) =>
      finding.code === "IMAGE_MEDIA_REQUIRED" ||
      finding.code === "AUDIO_MEDIA_REQUIRED" ||
      finding.code === "NOTE_TAKING_OPTION_REVEALS_ANSWER" ||
      finding.code.startsWith("CHOICE_LABEL_"),
  );
export const currentMediaFindings = async (
  input: WorkflowInput,
  item: Awaited<ReturnType<typeof repository.getContent>>,
  tx: Transaction,
) => {
  if (input.kind !== "question") return [];
  const question = item as Awaited<ReturnType<typeof repository.getQuestion>>;
  const associations = await repository.lockQuestionMediaEntries([input.targetId], tx);
  return engineMediaFindings(
    question!.engine,
    associations.map((entry) => ({ ...entry.media, position: entry.position - 1 })),
  );
};
