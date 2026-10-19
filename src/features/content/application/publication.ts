import { database } from "@/infrastructure/database/client";
import type { Actor } from "@/features/identity/domain/contracts";
import { workflowInputSchema, type WorkflowInput } from "../domain/contracts";
import * as repository from "../infrastructure/repositories";
import { ContentError, contentInput, currentMediaFindings, nonExceptionable, parse, staff } from "./shared";
/* Content publication and retirement; published versions are never edited afterwards. */
export async function publishContent(actor: Actor, input: WorkflowInput) {
  staff(actor);
  const valid = parse(workflowInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "approved")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only approved content can be published.",
      );
    const findings = await currentMediaFindings(valid, item, tx);
    if (nonExceptionable(findings))
      throw new ContentError(
        "VALIDATION_FAILED",
        "Required learner media and picture-choice labels cannot be excepted.",
        findings,
      );
    await repository.updateStatus(valid.kind, valid.targetId, "published", tx);
    await repository.recordAudit(
      "CONTENT_PUBLISHED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
export async function retireContent(actor: Actor, input: WorkflowInput) {
  staff(actor);
  const valid = parse(workflowInputSchema, input);
  return database.transaction(async (tx) => {
    const item = await contentInput(valid, tx);
    if (item.status !== "published")
      throw new ContentError(
        "CONTENT_TRANSITION_CONFLICT",
        "Only published content can be retired.",
      );
    await repository.updateStatus(valid.kind, valid.targetId, "retired", tx);
    await repository.recordAudit(
      "CONTENT_RETIRED",
      valid.kind,
      valid.targetId,
      actor.id,
      tx,
    );
  });
}
