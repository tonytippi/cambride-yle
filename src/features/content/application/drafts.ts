import { database } from "@/infrastructure/database/client";
import type { Actor } from "@/features/identity/domain/contracts";
import { mediaDraftSchema, questionDraftSchema, type MediaDraftInput, type QuestionDraftInput } from "../domain/contracts";
import * as repository from "../infrastructure/repositories";
import { ContentError, draftId, parse, staff, validateQuestionMedia, validateReferences } from "./shared";
/* Manual drafting: new drafts and revisions that always create a new version. */
export async function getContentDrafts(actor: Actor) {
  staff(actor);
  return repository.listDrafts();
}
export async function createManualQuestion(
  actor: Actor,
  input: QuestionDraftInput,
) {
  staff(actor);
  const valid = parse(questionDraftSchema, input);
  return database.transaction(async (tx) => {
    await validateReferences(valid, tx);
    await validateQuestionMedia(valid, tx);
    return repository.createQuestion(valid, actor.id, "manual", tx);
  });
}
export async function createManualMedia(actor: Actor, input: MediaDraftInput) {
  staff(actor);
  const valid = parse(mediaDraftSchema, input);
  return database.transaction(async (tx) => {
    await validateReferences(valid, tx);
    return repository.createMedia(valid, actor.id, "manual", tx);
  });
}
export async function reviseQuestion(
  actor: Actor,
  sourceId: string,
  input: QuestionDraftInput,
) {
  staff(actor);
  const source = draftId(sourceId, "QUESTION_DRAFT_NOT_FOUND");
  const valid = parse(questionDraftSchema, input);
  return database.transaction(async (tx) => {
    if (!(await repository.getQuestion(source, tx)))
      throw new ContentError(
        "QUESTION_DRAFT_NOT_FOUND",
        "The question draft was not found.",
      );
    await validateReferences(valid, tx);
    await validateQuestionMedia(valid, tx);
    return repository.createQuestion(valid, actor.id, "manual", tx, source);
  });
}
export async function reviseMedia(
  actor: Actor,
  sourceId: string,
  input: MediaDraftInput,
) {
  staff(actor);
  const source = draftId(sourceId, "MEDIA_DRAFT_NOT_FOUND");
  const valid = parse(mediaDraftSchema, input);
  return database.transaction(async (tx) => {
    if (!(await repository.getMedia(source, tx)))
      throw new ContentError(
        "MEDIA_DRAFT_NOT_FOUND",
        "The media draft was not found.",
      );
    await validateReferences(valid, tx);
    return repository.createMedia(valid, actor.id, "manual", tx, source);
  });
}
