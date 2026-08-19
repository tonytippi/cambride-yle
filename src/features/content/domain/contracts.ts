import { z } from "zod";

export const engines = ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"] as const;
const id = z.uuid();
export const normalisePlainText = (value: string) => value.replace(/\s+/g, " ").trim();
export const plainTextFindings = (field: string, value: unknown): ContentFindings => typeof value !== "string" ? [{ field, code: "STAFF_TEXT_INVALID", message: "Staff text must be plain text." }] : [
  ...(/<\/?[a-z][^>]*>|&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i.test(value) ? [{ field, code: "STAFF_TEXT_MARKUP", message: "Staff text must not contain HTML or markup." }] : []),
  ...(value !== normalisePlainText(value) ? [{ field, code: "STAFF_TEXT_WHITESPACE_NOT_NORMALISED", message: "Staff text whitespace must be normalised." }] : []),
];
const plainText = (max: number) => z.string().transform(normalisePlainText).pipe(z.string().min(1).max(max).refine((value) => !plainTextFindings("text", value).some((finding) => finding.code === "STAFF_TEXT_MARKUP"), "STAFF_TEXT_MARKUP"));
const plainTextOption = plainText(500);
const metadata = z.object({ altText: plainText(500) }).strict();
const provenance = z.object({ source: plainText(500), rightsReference: plainText(500) }).strict();
const postSubmitHint = z.object({ locale: z.literal("en-GB"), message: plainText(500) }).strict();
const previewUrl = z.string().refine((value) => { try { const url = new URL(value); return url.protocol === "https:" && !url.search && !url.hash; } catch { return false; } }, "must be an HTTPS URL without query or fragment");
const base = z.object({
  paper: z.enum(["listening", "reading_writing"]), part: z.number().int().min(1).max(5), engine: z.enum(engines),
  primaryTargetId: id, supportingTargetIds: z.array(id), topicIds: z.array(id), guidanceId: id,
  estimatedDurationSeconds: z.number().int().positive(), accessibilityMetadata: metadata, provenance,
});
export const questionDraftSchema = base.extend({ answerPolicyVersionId: id, prompt: plainText(2000), options: z.array(plainTextOption).min(1).max(10), postSubmitHint: postSubmitHint.optional() }).strict();
export const mediaDraftSchema = base.extend({ mediaType: z.enum(["image", "audio"]), previewUrl: previewUrl.optional(), description: plainText(2000) }).strict();
const imageMediaDraftSchema = mediaDraftSchema.extend({ mediaType: z.literal("image") });
const permittedReferenceSchema = z.object({ id: z.string().min(1).max(100), description: z.string().min(1).max(500) }).strict();
export const generationRequestSchema = z.discriminatedUnion("kind", [z.object({ kind: z.literal("text"), staffPrompt: z.string().min(1).max(2000), permittedReferences: z.array(permittedReferenceSchema).max(10), draft: questionDraftSchema }).strict(), z.object({ kind: z.literal("image"), staffPrompt: z.string().min(1).max(2000), permittedReferences: z.array(permittedReferenceSchema).max(10), draft: imageMediaDraftSchema }).strict()]);
export const generatedQuestionOutputSchema = z.object({ prompt: plainText(2000), options: z.array(plainTextOption).min(1).max(10) }).strict();
export const generatedMediaOutputSchema = z.object({ description: plainText(2000), previewUrl: previewUrl.optional() }).strict();
export type QuestionDraftInput = z.infer<typeof questionDraftSchema>;
export type MediaDraftInput = z.infer<typeof mediaDraftSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type ContentFindings = { field: string; code: string; message: string }[];
export const findingsFrom = (error: z.ZodError): ContentFindings => error.issues.map((issue) => ({ field: issue.path.join(".") || "content", code: issue.code.toUpperCase(), message: issue.message }));
const tokenPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
export const accessibilityLeakageFindings = (altText: unknown, options: unknown): ContentFindings => {
  if (typeof altText !== "string") return [];
  const findings: ContentFindings = [];
  if (/\b(?:correct\s*(?:answer\s*)?(?:is|was)|answer\s+(?:is|was)|choose\s+true\s*\/\s*false)\b|\b(?:correct\s+answer|correct|answer)\s*:|\b[\p{L}\p{N}][\p{L}\p{N}\s-]{0,120}\s+is\s+correct\b/iu.test(altText)) findings.push({ field: "accessibilityMetadata.altText", code: "ACCESSIBILITY_ANSWER_LEAKAGE", message: "Alternative text must not disclose the answer." });
  if (Array.isArray(options) && options.some((option) => typeof option === "string" && option.trim() && new RegExp(`(?:^|[^\\p{L}\\p{N}])${tokenPattern(option.trim())}(?:$|[^\\p{L}\\p{N}])`, "iu").test(altText))) findings.push({ field: "accessibilityMetadata.altText", code: "ACCESSIBILITY_OPTION_LEAKAGE", message: "Alternative text must not disclose an answer option." });
  return findings;
};
export const contentKindSchema = z.enum(["question", "media"]);
export const workflowInputSchema = z.object({ kind: contentKindSchema, targetId: id }).strict();
export const reasonInputSchema = workflowInputSchema.extend({ reason: plainText(2000) }).strict();
export const phonePreviewInputSchema = workflowInputSchema.extend({ viewportWidth: z.literal(375), successful: z.literal(true) }).strict();
export const composePracticeSetSchema = z.object({
  questionIds: z.array(id).min(1).max(20),
  mediaByQuestion: z.array(z.object({ questionId: id, mediaIds: z.array(id).max(20) }).strict()).max(20),
}).strict();
export const practiceSetWorkflowSchema = z.object({ practiceSetId: id }).strict();
export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type ComposePracticeSetInput = z.infer<typeof composePracticeSetSchema>;
