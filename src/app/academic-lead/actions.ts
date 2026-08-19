"use server";
import { revalidatePath } from "next/cache";
import {
  createAnswerPolicyVersion,
  createCurriculumGuidance,
  createCurriculumTarget,
  CurriculumError,
  updateCurriculumGuidance,
  updateCurriculumTarget,
} from "@/features/curriculum/application/curriculum";
import { currentActor } from "@/features/identity/ui/session";
import type { AnswerValue } from "@/features/curriculum/domain/contracts";
import { createManualMedia, createManualQuestion, requestAiDraft } from "@/features/content/application/content";
export type CurriculumActionState = {
  error?: {
    code: string;
    message: string;
    findings?: { field: string; code: string; message: string }[];
  };
  success?: string;
};
export type ContentActionState = CurriculumActionState;
const failure = (error: unknown, fallback: string): CurriculumActionState =>
  error instanceof CurriculumError ||
  (error instanceof Error && "code" in error)
    ? {
        error: {
          code: (error as CurriculumError).code,
          message: error.message,
          ...(error instanceof Error && "findings" in error && Array.isArray((error as { findings?: unknown }).findings) && (error as { findings: unknown[] }).findings.length
            ? { findings: (error as { findings: { field: string; code: string; message: string }[] }).findings }
            : {}),
        },
      }
    : { error: { code: fallback, message: "The record could not be saved." } };
const actorFor = async () => {
  const actor = await currentActor();
  if (!actor)
    throw new CurriculumError(
      "FORBIDDEN",
      "You do not have access to that page.",
    );
  return actor;
};
export async function createTargetAction(
  _: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  try {
    await createCurriculumTarget(await actorFor(), {
      canonicalId: String(formData.get("canonicalId") ?? ""),
      category: String(formData.get("category") ?? "") as "vocabulary",
      guidance: String(formData.get("guidance") ?? ""),
      isApproved: formData.get("isApproved") === "on",
    });
    revalidatePath("/academic-lead");
    return { success: "Curriculum target saved." };
  } catch (error) {
    return failure(error, "TARGET_SAVE_FAILED");
  }
}
export async function updateTargetAction(
  _: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  try {
    await updateCurriculumTarget(
      await actorFor(),
      String(formData.get("targetId")),
      {
        category: String(formData.get("category")) as "vocabulary",
        guidance: String(formData.get("guidance")),
        isApproved: formData.get("isApproved") === "on",
      },
    );
    revalidatePath("/academic-lead");
    return { success: "Curriculum target updated." };
  } catch (error) {
    return failure(error, "TARGET_UPDATE_FAILED");
  }
}
export async function createGuidanceAction(
  _: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  try {
    await createCurriculumGuidance(await actorFor(), {
      paper: String(formData.get("paper")) as "listening",
      part: Number(formData.get("part")),
      engine: String(formData.get("engine")) as "picture_true_false",
      topic: String(formData.get("topic")),
      taskFormat: String(formData.get("taskFormat")),
      maxWords: Number(formData.get("maxWords")),
      maxOptions: Number(formData.get("maxOptions")),
      approvedNames: String(formData.get("approvedNames") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      approvedNumbers: String(formData.get("approvedNumbers") ?? "")
        .split(",")
        .filter(Boolean)
        .map(Number),
    });
    revalidatePath("/academic-lead");
    return { success: "Internal guidance saved." };
  } catch (error) {
    return failure(error, "GUIDANCE_SAVE_FAILED");
  }
}
export async function updateGuidanceAction(
  _: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  try {
    await updateCurriculumGuidance(
      await actorFor(),
      String(formData.get("guidanceId")),
      {
        paper: String(formData.get("paper")) as "listening",
        part: Number(formData.get("part")),
        engine: String(formData.get("engine")) as "picture_true_false",
        topic: String(formData.get("topic")),
        taskFormat: String(formData.get("taskFormat")),
        maxWords: Number(formData.get("maxWords")),
        maxOptions: Number(formData.get("maxOptions")),
        approvedNames: String(formData.get("approvedNames") ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        approvedNumbers: String(formData.get("approvedNumbers") ?? "")
          .split(",")
          .filter(Boolean)
          .map(Number),
      },
    );
    revalidatePath("/academic-lead");
    return { success: "Internal guidance updated." };
  } catch (error) {
    return failure(error, "GUIDANCE_UPDATE_FAILED");
  }
}
const parseValue = (raw: string, kind: string): AnswerValue => {
  if (kind === "boolean") {
    if (raw !== "true" && raw !== "false")
      throw new CurriculumError(
        "VALIDATION_FAILED",
        "Check the named validation findings.",
        [
          {
            field: "answer",
            code: "BOOLEAN_VALUE_INVALID",
            message: "Use true or false.",
          },
        ],
      );
    return raw === "true";
  }
  if (kind === "number") {
    if (!/^(?:0|[1-9][0-9]*)$/.test(raw))
      throw new CurriculumError(
        "VALIDATION_FAILED",
        "Check the named validation findings.",
        [
          {
            field: "answer",
            code: "NUMBER_VALUE_INVALID",
            message: "Use a whole number.",
          },
        ],
      );
    return Number(raw);
  }
  return raw;
};
const parseVectorValue = (raw: string, kind: string): AnswerValue =>
  kind === "number" && /[a-z]/i.test(raw) ? raw : parseValue(raw, kind);
export async function createPolicyAction(
  _: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  try {
    const inputKind = String(formData.get("inputKind"));
    const policyId = String(formData.get("policyId") ?? "");
    const teacherReviewIfUncertain =
      formData.get("teacherReviewIfUncertain") === "on";
    const outcomes =
      teacherReviewIfUncertain && (inputKind === "name" || inputKind === "word")
        ? ["correct", "incorrect", "needs_teacher_review"]
        : ["correct", "incorrect"];
    const canonicalAnswer = parseValue(
      String(formData.get("canonicalAnswer") ?? ""),
      inputKind,
    );
    const vectors = outcomes.map((expectedOutcome) => ({
      response: parseVectorValue(
        String(formData.get(`vector-${expectedOutcome}`) ?? ""),
        inputKind,
      ),
      expectedOutcome: expectedOutcome as "correct",
    }));
    await createAnswerPolicyVersion(await actorFor(), {
      ...(policyId
        ? { policyId }
        : { canonicalId: String(formData.get("canonicalId") ?? "") }),
      targetId: String(formData.get("targetId") ?? ""),
      guidanceId: String(formData.get("guidanceId") ?? ""),
      paper: String(formData.get("paper")) as "listening",
      part: Number(formData.get("part")),
      engine: String(formData.get("engine")) as "picture_true_false",
      inputKind: inputKind as "boolean",
      canonicalAnswer,
      acceptedAnswers: String(formData.get("acceptedAnswers") ?? "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => parseValue(value, inputKind)),
      normalisation: {
        unicode: "NFC",
        locale: "en-GB",
        caseSensitive: false,
        trimWhitespace: true,
        normalizePunctuation: true,
        normalizeNumberForms: inputKind === "number",
      },
      maxWords: Number(formData.get("maxWords")),
      teacherReviewIfUncertain,
      vectors,
    });
    revalidatePath("/academic-lead");
    return { success: "A new immutable answer-policy version was saved." };
  } catch (error) {
    return failure(error, "POLICY_SAVE_FAILED");
  }
}
export async function createQuestionDraftAction(_: ContentActionState, formData: FormData): Promise<ContentActionState> {
  try {
    await createManualQuestion(await actorFor(), {
      ...contentBase(formData), answerPolicyVersionId: String(formData.get("answerPolicyVersionId")), prompt: String(formData.get("prompt")), options: String(formData.get("options")).split("\n").map((option) => option.trim()).filter(Boolean),
    });
    revalidatePath("/academic-lead"); return { success: "Question draft saved for academic review." };
  } catch (error) { return failure(error, "CONTENT_DRAFT_SAVE_FAILED"); }
}
const contentBase = (formData: FormData) => ({ paper: String(formData.get("paper")) as "listening", part: Number(formData.get("part")), engine: String(formData.get("engine")) as "picture_true_false", primaryTargetId: String(formData.get("primaryTargetId")), supportingTargetIds: String(formData.get("supportingTargetIds") ?? "").split(",").map((id) => id.trim()).filter(Boolean), topicIds: [String(formData.get("topicId"))], guidanceId: String(formData.get("guidanceId")), estimatedDurationSeconds: Number(formData.get("estimatedDurationSeconds")), accessibilityMetadata: { altText: String(formData.get("altText")) }, provenance: { source: String(formData.get("source")), rightsReference: String(formData.get("rightsReference")) } });
export async function createMediaDraftAction(_: ContentActionState, formData: FormData): Promise<ContentActionState> { try { await createManualMedia(await actorFor(), { ...contentBase(formData), mediaType: String(formData.get("mediaType")) as "image", previewUrl: String(formData.get("previewUrl") || "") || undefined, description: String(formData.get("description")) }); revalidatePath("/academic-lead"); return { success: "Media draft saved for academic review." }; } catch (error) { return failure(error, "MEDIA_DRAFT_SAVE_FAILED"); } }
export async function requestAiDraftAction(_: ContentActionState, formData: FormData): Promise<ContentActionState> { try { const draft = formData.get("draftType") === "question" ? { ...contentBase(formData), answerPolicyVersionId: String(formData.get("answerPolicyVersionId")), prompt: String(formData.get("prompt")), options: String(formData.get("options")).split("\n").map((value) => value.trim()).filter(Boolean) } : { ...contentBase(formData), mediaType: String(formData.get("mediaType")) as "image", previewUrl: String(formData.get("previewUrl") || "") || undefined, description: String(formData.get("description")) }; const permittedReferences = String(formData.get("permittedReferences") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [id, ...description] = line.split("|"); return { id: id!.trim(), description: description.join("|").trim() }; }); const sourceId = String(formData.get("sourceId") || "") || undefined; await requestAiDraft(await actorFor(), { kind: String(formData.get("kind")) as "text", staffPrompt: String(formData.get("staffPrompt")), permittedReferences, draft } as never, sourceId); revalidatePath("/academic-lead"); return { success: sourceId ? "AI draft rerun saved for academic review." : "Generated draft saved for academic review." }; } catch (error) { return failure(error, "AI_DRAFT_REQUEST_FAILED"); } }
