import { z } from "zod";
import type { Actor } from "@/features/identity/domain/contracts";
import { authorise } from "@/features/identity/application/auth";
import { getActiveLearnerById, recordEvidenceRead, recordEvidenceResolution } from "@/features/identity/infrastructure/repositories";
import { appendTeacherEvidenceResolution, submittedEvidenceReader } from "../infrastructure/repositories";
import { evidenceState, latestFactsPerSet, type EvidenceState } from "../domain/evidence-state";
import type { SubmittedEvidenceDetail, SubmittedEvidenceFilter } from "@/features/practice/application/evidence-contract";

const filterKeys = ["learnerId", "paper", "part", "vocabulary", "grammar", "spelling", "names", "numbers", "colours", "positions", "topic", "practiceSetId"] as const;
const inputSchema = z.object({ learnerId: z.string().uuid().optional(), paper: z.enum(["listening", "reading_writing"]).optional(), part: z.string().trim().regex(/^[1-5]$/).optional(), vocabulary: z.string().trim().min(1).max(120).optional(), grammar: z.string().trim().min(1).max(120).optional(), spelling: z.string().trim().min(1).max(120).optional(), names: z.string().trim().min(1).max(120).optional(), numbers: z.string().trim().min(1).max(120).optional(), colours: z.string().trim().min(1).max(120).optional(), positions: z.string().trim().min(1).max(120).optional(), topic: z.string().trim().min(1).max(120).optional(), practiceSetId: z.string().uuid().optional() }).strict();
export type CentreEvidenceRow = { learnerId: string; learnerName: string; paper: "listening" | "reading_writing"; part: string; languageTarget: string; state: EvidenceState; assessableOutcomes: number; correctOutcomes: number };
export type CentreEvidence = { rows: CentreEvidenceRow[]; details: SubmittedEvidenceDetail[]; readAt: Date; filter: SubmittedEvidenceFilter };
export type CentreEvidenceInput = SubmittedEvidenceFilter;
const matchesFilter = <T extends { learnerId: string; practiceSetId: string; paper: string; part: string; languageTarget: string; dimensions: Record<string, string[]> }>(rows: T[], filter: SubmittedEvidenceFilter) => rows.filter((row) => Object.entries(filter).every(([key, value]) => !value || (key === "learnerId" || key === "practiceSetId" || key === "paper" || key === "part" ? row[key] === value : key === "vocabulary" || key === "grammar" ? row.languageTarget === value || row.dimensions[key]?.includes(value) : row.dimensions[key]?.includes(value) ?? false)));

export async function getCentreEvidence(actor: Actor, input: unknown = {}): Promise<{ data: CentreEvidence } | { error: { code: "INPUT_INVALID"; message: string } }> {
  authorise(actor, ["teacher", "academic_lead", "admin"]);
  const now = new Date();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } };
  const filter = Object.fromEntries(filterKeys.flatMap((key) => parsed.data[key] ? [[key, parsed.data[key]]] : [])) as SubmittedEvidenceFilter;
  if (filter.learnerId && !await getActiveLearnerById(filter.learnerId)) return { error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } };
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const facts = matchesFilter(latestFactsPerSet((await submittedEvidenceReader.listSubmittedEvidenceFacts()).filter((fact) => fact.submittedAt >= since)), filter);
  const details = await submittedEvidenceReader.listSubmittedEvidenceDetails(filter);
  const groups = new Map<string, typeof facts>();
  for (const fact of facts) {
    const key = `${fact.learnerId}\0${fact.paper}\0${fact.part}\0${fact.languageTargetId}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const rows = [...groups.values()].map((group) => ({ learnerId: group[0]!.learnerId, learnerName: group[0]!.learnerName, paper: group[0]!.paper, part: group[0]!.part, languageTarget: group[0]!.languageTarget, ...evidenceState(group) })).sort((a, b) => a.learnerName.localeCompare(b.learnerName, "en-GB") || a.paper.localeCompare(b.paper) || a.part.localeCompare(b.part) || a.languageTarget.localeCompare(b.languageTarget, "en-GB"));
  await recordEvidenceRead(actor.id, filter.learnerId, rows.length || details.length ? "SUCCESS" : "NO_DATA");
  return { data: { rows, details, readAt: now, filter } };
}

const resolutionSchema = z.object({ reviewItemId: z.string().uuid(), outcome: z.enum(["correct", "incorrect", "unanswered"]), reason: z.string().trim().min(1).max(500), revision: z.number().int().min(0) }).strict();
export type ResolutionResult = { data: { revision: number; effectiveOutcome: "correct" | "incorrect" | "unanswered" } } | { error: { code: "INPUT_INVALID" | "RESOLUTION_TARGET_INVALID" | "TEACHER_RESOLUTION_CONFLICT"; message: string } };

export async function resolveUncertainItemOutcome(actor: Actor, input: unknown): Promise<ResolutionResult> {
  authorise(actor, ["academic_lead", "admin"]);
  const parsed = resolutionSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid resolution." } };
  const result = await appendTeacherEvidenceResolution({ reviewItemId: parsed.data.reviewItemId, outcome: parsed.data.outcome, reason: parsed.data.reason, expectedRevision: parsed.data.revision, resolverId: actor.id });
  if ("error" in result) {
    if (result.error === "TEACHER_RESOLUTION_CONFLICT") {
      try { await recordEvidenceResolution(actor.id, parsed.data.reviewItemId, "CONFLICT"); } catch { /* Conflict evidence is safe best-effort after the mutation transaction has ended. */ }
      return { error: { code: result.error, message: "This item was updated by someone else. Refresh and try again." } };
    }
    return { error: { code: "RESOLUTION_TARGET_INVALID", message: "Choose a valid resolution." } };
  }
  return { data: result };
}
