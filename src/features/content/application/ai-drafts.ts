import { database } from "@/infrastructure/database/client";
import type { Actor } from "@/features/identity/domain/contracts";
import { serverConfig } from "@/shared/config/server";
import { generatedMediaOutputSchema, generatedQuestionOutputSchema, generationRequestSchema, type GenerationRequest } from "../domain/contracts";
import { generatedProvenance, outputHash } from "../domain/provenance";
import { GatewayError, generate } from "../infrastructure/gateways";
import * as repository from "../infrastructure/repositories";
import { ContentError, draftId, parse, staff, validateQuestionMedia, validateReferences } from "./shared";
/* AI drafting stays blocked until GATE-AI-DRAFT-PROVIDER is closed; generated output is validated like a manual draft. */
export async function requestAiDraft(
  actor: Actor,
  input: GenerationRequest,
  sourceId?: string,
) {
  staff(actor);
  const request = parse(generationRequestSchema, input);
  const kind = request.kind === "text" ? "question" : "media";
  if (!serverConfig.AI_DRAFT_PROVIDER_GATE_CLOSED) {
    await database.transaction((tx) =>
      repository.recordAudit(
        "AI_DRAFT_REQUEST_BLOCKED_GATE_OPEN",
        kind,
        request.draft.primaryTargetId,
        actor.id,
        tx,
      ),
    );
    throw new ContentError(
      "AI_DRAFT_PROVIDER_GATE_OPEN",
      "AI draft generation is unavailable until the provider gate is closed.",
    );
  }
  try {
    const source = sourceId
      ? draftId(sourceId, "CONTENT_DRAFT_NOT_FOUND")
      : undefined;
    let permittedReferences: typeof request.permittedReferences = [];
    await database.transaction(async (tx) => {
      await validateReferences(request.draft, tx);
      if (request.kind === "text") await validateQuestionMedia(request.draft, tx);
      permittedReferences = await repository.resolvePermittedTextReferences(
        request.permittedReferences.map((reference) => reference.id),
        tx,
      );
      if (permittedReferences.length !== request.permittedReferences.length)
        throw new ContentError("VALIDATION_FAILED", "Check the named validation findings.", [{ field: "permittedReferences", code: "REFERENCE_NOT_CONTROLLED", message: "Every permitted text reference must be an approved controlled target." }]);
      if (source) {
        const exists =
          request.kind === "text"
            ? await repository.getQuestion(source, tx)
            : await repository.getMedia(source, tx);
        if (!exists)
          throw new ContentError(
            "CONTENT_DRAFT_NOT_FOUND",
            "The source draft was not found.",
          );
      }
    });
    let result;
    try {
      result = await generate({ ...request, permittedReferences });
    } catch (error) {
      if (error instanceof GatewayError)
        throw new ContentError(error.code, error.message);
      throw error;
    }
    const output =
      "answerPolicyVersionId" in request.draft
        ? parse(generatedQuestionOutputSchema, result.output)
        : parse(generatedMediaOutputSchema, result.output);
    return await database.transaction(async (tx) => {
      if (request.kind === "text") {
        const generated = {
          ...request.draft,
          ...(output as { prompt: string; options: string[] }),
          provenance: generatedProvenance(
            { ...request, permittedReferences },
            result.endpoint,
            result.model,
          ),
        };
        await validateReferences(generated, tx);
        await validateQuestionMedia(generated, tx);
        const targetId = await repository.createQuestion(
          generated,
          actor.id,
          "generated",
          tx,
          source,
        );
        await repository.recordGeneration(
          kind,
          targetId,
          request.kind,
          result.endpoint,
          result.model,
          { staffPrompt: request.staffPrompt },
          permittedReferences,
          outputHash(result.output),
          tx,
        );
        await repository.recordAudit(
          "AI_DRAFT_REQUEST_SUCCEEDED",
          kind,
          targetId,
          actor.id,
          tx,
        );
        return targetId;
      }
      const generated = {
        ...request.draft,
        ...(output as { description: string; previewUrl?: string }),
        provenance: generatedProvenance({ ...request, permittedReferences }, result.endpoint, result.model),
      };
      await validateReferences(generated, tx);
      const targetId = await repository.createMedia(
        generated,
        actor.id,
        "generated",
        tx,
        source,
      );
      await repository.recordGeneration(
        kind,
        targetId,
        request.kind,
        result.endpoint,
        result.model,
        { staffPrompt: request.staffPrompt },
        permittedReferences,
        outputHash(result.output),
        tx,
      );
      await repository.recordAudit(
        "AI_DRAFT_REQUEST_SUCCEEDED",
        kind,
        targetId,
        actor.id,
        tx,
      );
      return targetId;
    });
  } catch (error) {
    try {
      await database.transaction((tx) =>
        repository.recordAudit(
          "AI_DRAFT_REQUEST_FAILED",
          kind,
          request.draft.primaryTargetId,
          actor.id,
          tx,
        ),
      );
    } catch {
      /* Preserve the original downstream failure if independent audit persistence also fails. */
    }
    throw error;
  }
}
