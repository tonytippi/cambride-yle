import { z } from "zod";

export const engines = ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"] as const;
const id = z.uuid();
const metadata = z.object({ altText: z.string().min(1).max(500) }).strict();
const provenance = z.object({ source: z.string().min(1).max(500), rightsReference: z.string().min(1).max(500) }).strict();
const previewUrl = z.string().refine((value) => { try { const url = new URL(value); return url.protocol === "https:" && !url.search && !url.hash; } catch { return false; } }, "must be an HTTPS URL without query or fragment");
const base = z.object({
  paper: z.enum(["listening", "reading_writing"]), part: z.number().int().min(1).max(5), engine: z.enum(engines),
  primaryTargetId: id, supportingTargetIds: z.array(id), topicIds: z.array(id), guidanceId: id,
  estimatedDurationSeconds: z.number().int().positive(), accessibilityMetadata: metadata, provenance,
});
export const questionDraftSchema = base.extend({ answerPolicyVersionId: id, prompt: z.string().min(1).max(2000), options: z.array(z.string().min(1).max(500)).min(1).max(10) }).strict();
export const mediaDraftSchema = base.extend({ mediaType: z.enum(["image", "audio"]), previewUrl: previewUrl.optional(), description: z.string().min(1).max(2000) }).strict();
const permittedReferenceSchema = z.object({ id: z.string().min(1).max(100), description: z.string().min(1).max(500) }).strict();
export const generationRequestSchema = z.discriminatedUnion("kind", [z.object({ kind: z.literal("text"), staffPrompt: z.string().min(1).max(2000), permittedReferences: z.array(permittedReferenceSchema).max(10), draft: questionDraftSchema }).strict(), z.object({ kind: z.literal("image"), staffPrompt: z.string().min(1).max(2000), permittedReferences: z.array(permittedReferenceSchema).max(10), draft: mediaDraftSchema }).strict()]);
export const generatedQuestionOutputSchema = z.object({ prompt: z.string().min(1).max(2000), options: z.array(z.string().min(1).max(500)).min(1).max(10) }).strict();
export const generatedMediaOutputSchema = z.object({ description: z.string().min(1).max(2000), previewUrl: previewUrl.optional() }).strict();
export type QuestionDraftInput = z.infer<typeof questionDraftSchema>;
export type MediaDraftInput = z.infer<typeof mediaDraftSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type ContentFindings = { field: string; code: string; message: string }[];
export const findingsFrom = (error: z.ZodError): ContentFindings => error.issues.map((issue) => ({ field: issue.path.join(".") || "content", code: issue.code.toUpperCase(), message: issue.message }));
