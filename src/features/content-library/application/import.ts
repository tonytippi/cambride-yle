import "server-only";
import { z } from "zod";
import { database } from "@/infrastructure/database/client";
import { authorise } from "@/features/identity/application/auth";
import type { Actor } from "@/features/identity/domain/contracts";
import * as content from "@/features/content/infrastructure/repositories";
import { publishPracticeSetInTransaction } from "@/features/content/application/practice-sets";
import { importTarget, isRecordKey, libraryPrefix, parseRecord, reaches, type LibraryRecord, type LibraryStatus, type MediaRecord, type PolicyRecord, type PracticeSetRecord, type QuestionRecord } from "../domain/records";
import { ContentLibraryError, r2LibraryStore, type LibraryStore } from "../infrastructure/library-store";
import * as repository from "../infrastructure/repositories";

const importReason = "Imported from content library";
const staff = (actor: Actor) => authorise(actor, ["academic_lead", "admin"]);

async function readLibrary(store: LibraryStore) {
  const keys = (await store.listKeys(libraryPrefix)).filter(isRecordKey);
  const records: LibraryRecord[] = [];
  for (let index = 0; index < keys.length; index += 8) {
    const texts = await Promise.all(keys.slice(index, index + 8).map((key) => store.readText(key)));
    for (const text of texts) {
      const record = text === undefined ? undefined : parseRecord(text);
      if (record) records.push(record);
    }
  }
  const byKind = <K extends LibraryRecord["kind"]>(kind: K) => records.filter((record): record is Extract<LibraryRecord, { kind: K }> => record.kind === kind);
  return { targets: byKind("target"), guidance: byKind("guidance"), policies: byKind("policy"), questions: byKind("question"), media: byKind("media"), sets: byKind("practice_set") };
}
type Library = Awaited<ReturnType<typeof readLibrary>>;

/* The archive page: every practice set in the library and whether this database already has it. */
export async function getContentArchive(actor: Actor, store: LibraryStore = r2LibraryStore()) {
  staff(actor);
  const [library, existing] = await Promise.all([readLibrary(store), repository.existingContentIds()]);
  const inSets = new Set(library.sets.flatMap((set) => set.questionIds));
  return {
    sets: library.sets
      .map((set) => ({ id: set.id, title: set.title, paper: set.paper, part: set.part, status: set.status, approvedBy: set.approvedBy, questionCount: set.questionIds.length, localStatus: existing.get(set.id) }))
      .sort((left, right) => left.title.localeCompare(right.title, "en-GB")),
    looseQuestions: library.questions.filter((question) => !inSets.has(question.id)).length,
    totals: { questions: library.questions.length, media: library.media.length, missing: [...library.questions, ...library.media, ...library.sets].filter((record) => !existing.has(record.id)).length },
  };
}

export const importInputSchema = z.union([z.object({ all: z.literal(true) }), z.object({ practiceSetIds: z.array(z.uuid()).min(1).max(200) })]);
export type ImportInput = z.infer<typeof importInputSchema>;
type Kind = "curriculum" | "media" | "question" | "practice_set";
export type ImportReport = {
  imported: { kind: Kind; id: string; label: string; status: LibraryStatus }[];
  present: { kind: Kind; id: string; label: string }[];
  failed: { kind: Kind; id: string; label: string; code: string; message: string }[];
  warnings: string[];
};

/* The selected sets with every question, media version and curriculum record they depend on. */
function closure(library: Library, input: ImportInput) {
  if ("all" in input) return library;
  const sets = library.sets.filter((set) => input.practiceSetIds.includes(set.id));
  const questionIds = new Set(sets.flatMap((set) => set.questionIds));
  const questions = library.questions.filter((question) => questionIds.has(question.id));
  const mediaIds = new Set(questions.flatMap((question) => question.mediaIds));
  const media = library.media.filter((item) => mediaIds.has(item.id));
  const policyVersionIds = new Set(questions.map((question) => question.answerPolicyVersionId));
  const policies = library.policies.filter((policy) => policy.versions.some((version) => policyVersionIds.has(version.id)));
  const items = [...questions, ...media];
  const targetIds = new Set([...items.flatMap((item) => [item.primaryTargetId, ...item.supportingTargetIds, ...item.topicIds]), ...sets.flatMap((set) => set.primaryTargetIds), ...policies.map((policy) => policy.targetId)]);
  const guidanceIds = new Set([...items.map((item) => item.guidanceId), ...policies.map((policy) => policy.guidanceId)]);
  return { targets: library.targets.filter((target) => targetIds.has(target.id)), guidance: library.guidance.filter((item) => guidanceIds.has(item.id)), policies, questions, media, sets };
}

const failure = (error: unknown) => {
  if (error instanceof Error && "code" in error && typeof (error as { code: unknown }).code === "string" && /^[A-Z_]+$/.test((error as { code: string }).code)) {
    const findings = "findings" in error && Array.isArray(error.findings) ? (error.findings as { message?: string }[]).map((finding) => finding.message).filter(Boolean) : [];
    return { code: (error as { code: string }).code, message: findings.length ? `${error.message} ${findings.join(" ")}` : error.message };
  }
  // Database guards raise their code as the message; Drizzle may wrap it as the cause.
  const message = error instanceof Error ? ((error.cause instanceof Error && error.cause.message) || error.message) : String(error);
  return { code: /([A-Z][A-Z_]{5,})/.exec(message)?.[1] ?? "CONTENT_LIBRARY_IMPORT_FAILED", message };
};
const shorten = (value: string) => (value.length > 80 ? `${value.slice(0, 77)}...` : value);

/*
 * Brings library content into this database with its original IDs. Approved and later versions
 * replay the normal transitions (validation, review, approval, publication) so every database
 * guard still applies; the approver is the original reviewer when their account exists here,
 * otherwise the importing staff member. Each record imports in its own transaction.
 */
export async function importFromLibrary(actor: Actor, input: ImportInput, store: LibraryStore = r2LibraryStore()): Promise<ImportReport> {
  staff(actor);
  const parsed = importInputSchema.safeParse(input);
  if (!parsed.success) throw new ContentLibraryError("VALIDATION_FAILED", "Choose at least one practice set to import.");
  const selected = closure(await readLibrary(store), parsed.data);
  const report: ImportReport = { imported: [], present: [], failed: [], warnings: [] };
  const all = [...selected.targets, ...selected.policies, ...selected.questions, ...selected.media, ...selected.sets];
  const people = await repository.accountIdsByEmail(all.flatMap((record) => ["createdBy" in record ? record.createdBy : null, "approvedBy" in record ? record.approvedBy : null, ...(record.kind === "policy" ? record.versions.map((version) => version.createdBy) : [])]), database);
  const person = (email: string | null) => (email && people.get(email)) || actor.id;

  // Curriculum first: an existing record with the same natural key wins and references are remapped to it.
  const ids = new Map<string, string>();
  const refs = (id: string) => ids.get(id) ?? id;
  try {
    await database.transaction(async (tx) => {
      for (const target of selected.targets) {
        const resolved = await repository.resolveTarget(target, person(target.createdBy), tx);
        ids.set(target.id, resolved.id);
        if (resolved.differs) report.warnings.push(`Curriculum target "${target.canonicalId}" differs from the library; this database's version was kept.`);
      }
      for (const item of selected.guidance) {
        const resolved = await repository.resolveGuidance(item, tx);
        ids.set(item.id, resolved.id);
        if (resolved.differs) report.warnings.push(`Guidance "${item.topic} / ${item.taskFormat}" differs from the library; this database's version was kept.`);
      }
      for (const policy of selected.policies as PolicyRecord[]) {
        const resolved = await repository.resolvePolicy(policy, refs(policy.targetId), refs(policy.guidanceId), person, tx);
        for (const [from, to] of resolved.ids) ids.set(from, to);
        if (resolved.differs) report.warnings.push(`Answer policy "${policy.canonicalId}" differs from the library; this database's versions were kept.`);
      }
    });
  } catch (error) {
    report.failed.push({ kind: "curriculum", id: "", label: "Curriculum", ...failure(error) });
    return report;
  }

  const existing = await repository.existingContentIds();
  const available = new Set(existing.keys());
  const retirements: { kind: "question" | "media"; id: string }[] = [];
  const byCreation = <T extends { createdAt: string }>(records: T[]) => [...records].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const replayContent = async (record: QuestionRecord | MediaRecord, tx: Parameters<Parameters<typeof database.transaction>[0]>[0]) => {
    const target = importTarget(record.status);
    if (!reaches(target, "approved")) return;
    const approver = person(record.approvedBy);
    const validationId = await content.recordValidation(record.kind, record.id, actor.id, [], tx);
    await content.recordReview(record.kind, record.id, approver, "submitted", [], tx, validationId, importReason);
    await content.updateStatus(record.kind, record.id, "in_review", tx);
    if (record.kind === "media" && record.mediaType === "image") await content.recordPhonePreview(record.id, approver, tx);
    await content.recordReview(record.kind, record.id, approver, "approved", [], tx, validationId, importReason);
    await content.updateStatus(record.kind, record.id, "approved", tx);
    if (reaches(target, "published")) await content.updateStatus(record.kind, record.id, "published", tx);
    // Retire only after dependent sets are published from these versions.
    if (target === "retired") retirements.push({ kind: record.kind, id: record.id });
  };

  for (const record of byCreation(selected.media as MediaRecord[])) {
    const label = shorten(record.description);
    if (available.has(record.id)) { report.present.push({ kind: "media", id: record.id, label }); continue; }
    try {
      if (record.file && (await store.copyMedia("from_library", record.file.contentSha256, record.file.contentType)) === "missing")
        throw new ContentLibraryError("CONTENT_LIBRARY_MEDIA_MISSING", "The media file is missing from the library.");
      await database.transaction(async (tx) => {
        await repository.insertMediaDraft(record, refs, person(record.createdBy), tx);
        await replayContent(record, tx);
        await content.recordAudit("CONTENT_IMPORTED", "media", record.id, actor.id, tx);
      });
      available.add(record.id);
      report.imported.push({ kind: "media", id: record.id, label, status: importTarget(record.status) });
    } catch (error) {
      report.failed.push({ kind: "media", id: record.id, label, ...failure(error) });
    }
  }

  for (const record of byCreation(selected.questions as QuestionRecord[])) {
    const label = shorten(record.prompt);
    if (available.has(record.id)) { report.present.push({ kind: "question", id: record.id, label }); continue; }
    try {
      if (record.mediaIds.some((id) => !available.has(id))) throw new ContentLibraryError("CONTENT_LIBRARY_DEPENDENCY_MISSING", "A picture or sound this question uses could not be imported.");
      await database.transaction(async (tx) => {
        await repository.insertQuestionDraft(record, refs, person(record.createdBy), tx);
        await replayContent(record, tx);
        await content.recordAudit("CONTENT_IMPORTED", "question", record.id, actor.id, tx);
      });
      available.add(record.id);
      report.imported.push({ kind: "question", id: record.id, label, status: importTarget(record.status) });
    } catch (error) {
      report.failed.push({ kind: "question", id: record.id, label, ...failure(error) });
    }
  }

  for (const record of byCreation(selected.sets as PracticeSetRecord[])) {
    const label = shorten(record.title);
    if (available.has(record.id)) { report.present.push({ kind: "practice_set", id: record.id, label }); continue; }
    try {
      if (record.questionIds.some((id) => !available.has(id))) throw new ContentLibraryError("CONTENT_LIBRARY_DEPENDENCY_MISSING", "A question in this set could not be imported.");
      const target = importTarget(record.status);
      await database.transaction(async (tx) => {
        await repository.insertPracticeSetDraft(record, refs, person(record.createdBy), tx);
        if (reaches(target, "approved")) {
          const approver = person(record.approvedBy);
          await content.recordPracticeSetReview(record.id, approver, "submitted", [], tx);
          await content.updatePracticeSetStatus(record.id, "in_review", tx);
          await content.recordPracticeSetReview(record.id, approver, "approved", [], tx);
          await content.updatePracticeSetStatus(record.id, "approved", tx);
        }
        if (reaches(target, "published")) await publishPracticeSetInTransaction(actor.id, record.id, tx);
        if (target === "retired") await content.retirePracticeSet(record.id, tx);
        await content.recordPracticeSetAudit("PRACTICE_SET_IMPORTED", record.id, actor.id, tx);
      });
      available.add(record.id);
      report.imported.push({ kind: "practice_set", id: record.id, label, status: target });
    } catch (error) {
      report.failed.push({ kind: "practice_set", id: record.id, label, ...failure(error) });
    }
  }

  for (const retirement of retirements) {
    try {
      await database.transaction((tx) => content.updateStatus(retirement.kind, retirement.id, "retired", tx));
    } catch (error) {
      report.failed.push({ kind: retirement.kind, id: retirement.id, label: "Retirement", ...failure(error) });
    }
  }
  return report;
}
