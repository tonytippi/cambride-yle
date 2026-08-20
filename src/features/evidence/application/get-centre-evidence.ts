import { z } from "zod";
import type { Actor } from "@/features/identity/domain/contracts";
import { authorise } from "@/features/identity/application/auth";
import { getAccountById, recordEvidenceRead } from "@/features/identity/infrastructure/repositories";
import { submittedEvidenceReader } from "../infrastructure/repositories";
import { evidenceState, latestFactsPerSet, type EvidenceState } from "../domain/evidence-state";

const inputSchema = z.object({ learnerId: z.string().uuid().optional() }).strict();
export type CentreEvidenceRow = { learnerId: string; learnerName: string; paper: "listening" | "reading_writing"; part: string; languageTarget: string; state: EvidenceState; assessableOutcomes: number; correctOutcomes: number };
export type CentreEvidence = { rows: CentreEvidenceRow[]; readAt: Date };

export async function getCentreEvidence(actor: Actor, input: unknown = {}): Promise<{ data: CentreEvidence } | { error: { code: "INPUT_INVALID"; message: string } }> {
  authorise(actor, ["teacher", "academic_lead", "admin"]);
  const now = new Date();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } };
  if (parsed.data.learnerId && !await getAccountById(parsed.data.learnerId)) return { error: { code: "INPUT_INVALID", message: "Choose a valid evidence view." } };
  const facts = latestFactsPerSet(await submittedEvidenceReader.listSubmittedEvidenceFacts(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))).filter((fact) => !parsed.data.learnerId || fact.learnerId === parsed.data.learnerId);
  const groups = new Map<string, typeof facts>();
  for (const fact of facts) {
    const key = `${fact.learnerId}\0${fact.paper}\0${fact.part}\0${fact.languageTargetId}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const rows = [...groups.values()].map((group) => ({ learnerId: group[0]!.learnerId, learnerName: group[0]!.learnerName, paper: group[0]!.paper, part: group[0]!.part, languageTarget: group[0]!.languageTarget, ...evidenceState(group) })).sort((a, b) => a.learnerName.localeCompare(b.learnerName, "en-GB") || a.paper.localeCompare(b.paper) || a.part.localeCompare(b.part) || a.languageTarget.localeCompare(b.languageTarget, "en-GB"));
  await recordEvidenceRead(actor.id, parsed.data.learnerId, rows.length ? "SUCCESS" : "NO_DATA");
  return { data: { rows, readAt: now } };
}
