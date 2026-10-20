import { database } from "@/infrastructure/database/client";
import { authorise } from "@/features/identity/application/auth";
import type { Actor } from "@/features/identity/domain/contracts";
import { mediaDraftSchema, questionDraftSchema, type MediaDraftInput, type QuestionDraftInput } from "../domain/contracts";
import * as repository from "../infrastructure/repositories";
import { storeMediaFile, storedFileOf, type MediaUpload } from "./media-files";
import { ContentError, draftId, parse, staff, validateQuestionMedia, validateReferences } from "./shared";
/* Manual drafting: new drafts and revisions that always create a new version. */
export async function getContentDrafts(actor: Actor) {
  staff(actor);
  return repository.listDrafts();
}
/* Staff preview of a media version's stored file; teachers may only see published media. */
export async function getMediaFile(actor: Actor, mediaId: string) {
  authorise(actor, ["teacher", "academic_lead", "admin"]);
  const media = await repository.getMedia(draftId(mediaId, "MEDIA_DRAFT_NOT_FOUND"));
  if (actor.role === "teacher" && media?.status !== "published") return undefined;
  return storedFileOf(media);
}
/* Read-only library of published questions and practice sets for teachers and content staff. */
export async function getPublishedLibrary(actor: Actor) {
  authorise(actor, ["teacher", "academic_lead", "admin"]);
  return repository.listPublishedLibrary();
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
export async function createManualMedia(actor: Actor, input: MediaDraftInput, upload?: MediaUpload) {
  staff(actor);
  const valid = parse(mediaDraftSchema, input);
  const file = upload && (await storeMediaFile(valid.mediaType, upload));
  return database.transaction(async (tx) => {
    await validateReferences(valid, tx);
    return repository.createMedia(valid, actor.id, "manual", tx, undefined, file);
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
  upload?: MediaUpload,
) {
  staff(actor);
  const source = draftId(sourceId, "MEDIA_DRAFT_NOT_FOUND");
  const valid = parse(mediaDraftSchema, input);
  const uploaded = upload && (await storeMediaFile(valid.mediaType, upload));
  return database.transaction(async (tx) => {
    const current = await repository.getMedia(source, tx);
    if (!current)
      throw new ContentError(
        "MEDIA_DRAFT_NOT_FOUND",
        "The media draft was not found.",
      );
    await validateReferences(valid, tx);
    const inherited = current.mediaType === valid.mediaType ? storedFileOf(current) : undefined;
    return repository.createMedia(valid, actor.id, "manual", tx, source, uploaded ?? inherited);
  });
}
