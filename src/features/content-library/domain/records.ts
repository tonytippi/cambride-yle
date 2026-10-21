import { z } from "zod";

/*
 * The shared content library on R2: one JSON file per curriculum record and per content version.
 * Content is immutable per version; only `status` and `approvedBy` change. PostgreSQL stays the
 * runtime source of truth, and the library is only an archive for moving content between databases.
 */
export const libraryPrefix = "content-library/v1/";
export const mediaFileKey = (sha256: string) => `${libraryPrefix}media-files/${sha256}`;

const status = z.enum(["draft", "in_review", "approved", "published", "retired"]);
export type LibraryStatus = z.infer<typeof status>;
const statusRank: Record<LibraryStatus, number> = { draft: 0, in_review: 1, approved: 2, published: 3, retired: 4 };
const email = z.string().nullable();
const uuid = z.uuid();

const targetRecord = z.object({
  schemaVersion: z.literal(1), kind: z.literal("target"), id: uuid, canonicalId: z.string(), category: z.enum(["vocabulary", "grammar", "topic", "language_target"]),
  level: z.literal("starters"), guidance: z.string(), isApproved: z.boolean(), createdBy: email,
});
const guidanceRecord = z.object({
  schemaVersion: z.literal(1), kind: z.literal("guidance"), id: uuid, paper: z.enum(["listening", "reading_writing"]), part: z.number().int(),
  engine: z.string(), topic: z.string(), taskFormat: z.string(), maxWords: z.number().int(), maxOptions: z.number().int(), approvedNames: z.unknown(), approvedNumbers: z.unknown(),
});
const policyRecord = z.object({
  schemaVersion: z.literal(1), kind: z.literal("policy"), id: uuid, canonicalId: z.string(), targetId: uuid, guidanceId: uuid,
  paper: z.enum(["listening", "reading_writing"]), part: z.number().int(), engine: z.string(),
  versions: z.array(z.object({
    id: uuid, version: z.number().int(), inputKind: z.string(), canonicalAnswer: z.unknown(), acceptedAnswers: z.unknown(), normalisation: z.unknown(),
    maxWords: z.number().int(), teacherReviewIfUncertain: z.boolean(), createdBy: email,
    vectors: z.array(z.object({ response: z.unknown(), expectedOutcome: z.string() })),
  })),
});
const contentBase = {
  schemaVersion: z.literal(1), id: uuid, status, approvedBy: email, origin: z.enum(["manual", "generated"]), level: z.literal("starters"),
  paper: z.enum(["listening", "reading_writing"]), part: z.string(), engine: z.string(), primaryTargetId: uuid, supportingTargetIds: z.array(uuid), topicIds: z.array(uuid),
  guidanceId: uuid, evidenceDimensions: z.unknown(), estimatedDurationSeconds: z.string(), accessibilityMetadata: z.unknown(), provenance: z.unknown(),
  sourceVersionId: uuid.nullable(), createdBy: email, createdAt: z.string(),
};
const questionRecord = z.object({
  ...contentBase, kind: z.literal("question"), answerPolicyVersionId: uuid, prompt: z.string(), options: z.unknown(), postSubmitHint: z.unknown(), mediaIds: z.array(uuid),
});
const mediaRecord = z.object({
  ...contentBase, kind: z.literal("media"), mediaType: z.string(), previewUrl: z.string().nullable(), description: z.string(),
  file: z.object({ objectKey: z.string(), contentType: z.string(), byteSize: z.number().int(), contentSha256: z.string().regex(/^[0-9a-f]{64}$/) }).nullable(),
});
const practiceSetRecord = z.object({
  schemaVersion: z.literal(1), kind: z.literal("practice_set"), id: uuid, status, approvedBy: email, title: z.string(), paper: z.enum(["listening", "reading_writing"]),
  part: z.string(), estimatedDurationSeconds: z.number().int(), primaryTargetIds: z.array(uuid), questionIds: z.array(uuid), createdBy: email, createdAt: z.string(),
});

export const libraryRecordSchema = z.discriminatedUnion("kind", [targetRecord, guidanceRecord, policyRecord, questionRecord, mediaRecord, practiceSetRecord]);
export type LibraryRecord = z.infer<typeof libraryRecordSchema>;
export type TargetRecord = z.infer<typeof targetRecord>;
export type GuidanceRecord = z.infer<typeof guidanceRecord>;
export type PolicyRecord = z.infer<typeof policyRecord>;
export type QuestionRecord = z.infer<typeof questionRecord>;
export type MediaRecord = z.infer<typeof mediaRecord>;
export type PracticeSetRecord = z.infer<typeof practiceSetRecord>;

const folders = { target: "curriculum/targets", guidance: "curriculum/guidance", policy: "curriculum/policies", question: "questions", media: "media", practice_set: "practice-sets" } as const;
export const recordKey = (record: Pick<LibraryRecord, "kind" | "id">) => `${libraryPrefix}${folders[record.kind]}/${record.id}.json`;
export const isRecordKey = (key: string) => key.startsWith(libraryPrefix) && key.endsWith(".json");

export const serialiseRecord = (record: LibraryRecord) => `${JSON.stringify(record, null, 2)}\n`;
export const parseRecord = (text: string): LibraryRecord | undefined => {
  try {
    const result = libraryRecordSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

/*
 * Several databases push into one library, so a push never moves a version backwards: the further
 * lifecycle status wins together with its approver, and policy versions are a union by number.
 */
export function mergeForPush(existing: LibraryRecord | undefined, next: LibraryRecord): LibraryRecord {
  if (!existing || existing.kind !== next.kind) return next;
  if (next.kind === "policy" && existing.kind === "policy") {
    const versions = new Map(existing.versions.map((version) => [version.version, version]));
    for (const version of next.versions) versions.set(version.version, version);
    return { ...next, versions: [...versions.values()].sort((left, right) => left.version - right.version) };
  }
  if ("status" in next && "status" in existing && statusRank[existing.status] > statusRank[next.status])
    return { ...next, status: existing.status, approvedBy: existing.approvedBy } as LibraryRecord;
  return next;
}

/* Status a record reaches when imported: anything not yet approved comes back as an editable draft. */
export const importTarget = (value: LibraryStatus): Exclude<LibraryStatus, "in_review"> => (value === "in_review" ? "draft" : value);
export const reaches = (value: LibraryStatus, step: LibraryStatus) => statusRank[importTarget(value)] >= statusRank[step];
