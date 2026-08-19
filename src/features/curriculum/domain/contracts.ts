import { z } from "zod";

export const engines = ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"] as const;
export const inputKinds = ["choice", "boolean", "yes_no", "number", "name", "word", "assignment"] as const;
export const engineInputKinds = { picture_true_false: ["boolean"], picture_yes_no: ["yes_no"], audio_picture_choice: ["choice"], audio_note_taking: ["number", "name"], word_bank_cloze: ["word", "assignment"] } as const satisfies Record<(typeof engines)[number], readonly (typeof inputKinds)[number][]>;
export const outcomes = ["correct", "incorrect", "needs_teacher_review"] as const;
export type Outcome = (typeof outcomes)[number];
export const canonicalId = z.string().trim().regex(/^[a-z][a-z0-9_]*(?:-[a-z0-9_]+)*$/, "CANONICAL_ID_INVALID").max(120);
export const targetSchema = z.object({ canonicalId, category: z.enum(["vocabulary", "grammar", "topic", "language_target"]), guidance: z.string().trim().min(1).max(2000), isApproved: z.boolean().default(false) });
export const guidanceSchema = z.object({ paper: z.enum(["listening", "reading_writing"]), part: z.coerce.number().int().min(1).max(5), engine: z.enum(engines), topic: z.string().trim().min(1).max(120), taskFormat: z.string().trim().min(1).max(120), maxWords: z.coerce.number().int().min(1).max(20), maxOptions: z.coerce.number().int().min(1).max(10), approvedNames: z.array(z.string().trim().min(1).max(120)).max(100), approvedNumbers: z.array(z.number().int().min(0).max(20)).max(21) });
export const normalisationSchema = z.object({ unicode: z.literal("NFC").default("NFC"), locale: z.literal("en-GB").default("en-GB"), caseSensitive: z.boolean().default(false), trimWhitespace: z.boolean().default(true), normalizePunctuation: z.boolean().default(true), normalizeNumberForms: z.boolean().default(false) });
const scalarSchemas = { choice: z.string().trim().min(1).max(120), boolean: z.boolean(), yes_no: z.enum(["yes", "no"]), number: z.number().int().min(0).max(20), name: z.string().trim().min(1).max(120), word: z.string().trim().min(1).max(120), assignment: z.record(z.string().min(1).max(120), z.string().min(1).max(120)) } as const;
const valueSchema = z.union([scalarSchemas.choice, scalarSchemas.boolean, scalarSchemas.number, scalarSchemas.assignment]);
export type AnswerValue = z.infer<typeof valueSchema>;
export const vectorSchema = z.object({ response: valueSchema, expectedOutcome: z.enum(outcomes) });
const policyBaseSchema = z.object({ policyId: z.string().uuid().optional(), canonicalId: canonicalId.optional(), targetId: z.string().uuid(), guidanceId: z.string().uuid(), paper: z.enum(["listening", "reading_writing"]), part: z.coerce.number().int().min(1).max(5), engine: z.enum(engines), inputKind: z.enum(inputKinds), canonicalAnswer: valueSchema, acceptedAnswers: z.array(valueSchema).max(20).default([]), normalisation: normalisationSchema.default({ unicode: "NFC", locale: "en-GB", caseSensitive: false, trimWhitespace: true, normalizePunctuation: true, normalizeNumberForms: false }), maxWords: z.coerce.number().int().min(1).max(20).default(1), teacherReviewIfUncertain: z.boolean().default(true), vectors: z.array(vectorSchema).min(3) });
export const policyVersionSchema = policyBaseSchema.superRefine((value, context) => {
  if (Boolean(value.policyId) === Boolean(value.canonicalId)) context.addIssue({ code: "custom", path: ["policyId"], message: "POLICY_CREATE_OR_APPEND_REQUIRED" });
  if (!engineInputKinds[value.engine].includes(value.inputKind as never)) context.addIssue({ code: "custom", path: ["inputKind"], message: "INPUT_KIND_NOT_SUPPORTED_FOR_ENGINE" });
  const shape = scalarSchemas[value.inputKind] as z.ZodType;
  for (const [field, values] of [["canonicalAnswer", [value.canonicalAnswer]], ["acceptedAnswers", value.acceptedAnswers]] as const) values.forEach((entry, index) => { if (!shape.safeParse(entry).success) context.addIssue({ code: "custom", path: [field, index], message: "ANSWER_VALUE_SHAPE_INVALID" }); });
  value.vectors.forEach((vector, index) => { const controlledNumberWord = value.inputKind === "number" && value.normalisation.normalizeNumberForms && typeof vector.response === "string"; if (vector.expectedOutcome !== "needs_teacher_review" && !controlledNumberWord && !shape.safeParse(vector.response).success) context.addIssue({ code: "custom", path: ["vectors", index, "response"], message: "ANSWER_VALUE_SHAPE_INVALID" }); });
});
export type TargetInput = z.infer<typeof targetSchema>;
export type GuidanceInput = z.infer<typeof guidanceSchema>;
export type PolicyVersionInput = z.infer<typeof policyVersionSchema>;
export type ValidationFinding = { field: string; code: string; message: string };
export const findingsFrom = (error: z.ZodError): ValidationFinding[] => error.issues.map((issue) => ({ field: issue.path.join(".") || "form", code: issue.message, message: issue.message.replaceAll("_", " ") }));
