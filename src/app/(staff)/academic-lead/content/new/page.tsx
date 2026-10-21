import Link from "next/link";
import { serverConfig } from "@/shared/config/server";
import { ContentEditor, type EditorMode, type EditorSource } from "@/features/content/ui/content-editor";
import { createMediaDraftAction, createQuestionDraftAction, requestAiDraftAction } from "../../actions";
import { loadWorkspace, type Workspace } from "../../workspace";

const modes: { mode: EditorMode; label: string; detail: string; ai?: true }[] = [
  { mode: "question", label: "Question", detail: "Write a question and attach its pictures or sounds." },
  { mode: "media", label: "Picture or sound", detail: "Upload a picture or sound file." },
  { mode: "ai-text", label: "AI question draft", detail: "Ask the AI to draft a question for review.", ai: true },
  { mode: "ai-image", label: "AI picture draft", detail: "Ask the AI to draw a picture for review.", ai: true },
];

function sourceOf(workspace: Workspace, mode: EditorMode, id: string | undefined): EditorSource | undefined {
  if (!id) return undefined;
  const item = mode === "question" ? workspace.drafts.questions.find((entry) => entry.id === id) : mode === "media" ? workspace.drafts.media.find((entry) => entry.id === id) : undefined;
  if (!item) return undefined;
  const accessibility = item.accessibilityMetadata as { altText?: string; choiceLabel?: string };
  const provenance = item.provenance as { source?: string; rightsReference?: string };
  const dimensions = (item.evidenceDimensions ?? {}) as { spelling?: string[]; colours?: string[]; positions?: string[] };
  const base = {
    id: item.id, guidanceId: item.guidanceId, primaryTargetId: item.primaryTargetId, topicId: (item.topicIds as string[])[0], supportingTargetIds: item.supportingTargetIds as string[],
    estimatedDurationSeconds: Number(item.estimatedDurationSeconds), altText: accessibility.altText ?? "", choiceLabel: accessibility.choiceLabel, source: provenance.source ?? "", rightsReference: provenance.rightsReference ?? "",
    spelling: dimensions.spelling ?? [], colours: dimensions.colours ?? [], positions: dimensions.positions ?? [],
  };
  if ("prompt" in item)
    return { ...base, answerPolicyVersionId: item.answerPolicyVersionId, prompt: item.prompt, options: item.options as string[], postSubmitHint: (item.postSubmitHint as { message?: string } | null)?.message, mediaIds: workspace.drafts.associations.filter((entry) => entry.questionVersionId === item.id).map((entry) => entry.mediaVersionId) };
  return { ...base, mediaType: item.mediaType, description: item.description, previewUrl: item.previewUrl ?? undefined, hasFile: Boolean(item.objectKey) };
}

export default async function CreateContent({ searchParams }: { searchParams: Promise<{ type?: string; source?: string }> }) {
  const params = await searchParams;
  const workspace = await loadWorkspace();
  const aiEnabled = serverConfig.AI_DRAFT_PROVIDER_GATE_CLOSED;
  const available = modes.filter((entry) => !entry.ai || aiEnabled);
  const mode = available.find((entry) => entry.mode === params.type)?.mode ?? "question";
  const source = sourceOf(workspace, mode, params.source);
  const action = mode === "question" ? createQuestionDraftAction : mode === "media" ? createMediaDraftAction : requestAiDraftAction;
  return (
    <>
      <h1>{source ? "Edit as a new revision" : "Create content"}</h1>
      {source ? (
        <p className="notice">You are revising <Link href={`/academic-lead/content?q=${source.id}`}>an existing version</Link>. Saving creates a new draft; the original, and anything already published, stays unchanged.</p>
      ) : (
        <nav aria-label="Content type" className="mode-tabs">
          <ul>
            {available.map((entry) => (
              <li key={entry.mode}>
                <Link href={`/academic-lead/content/new?type=${entry.mode}`} aria-current={entry.mode === mode ? "page" : undefined}>
                  <strong>{entry.label}</strong>
                  <span>{entry.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!aiEnabled && <p className="field-hint">AI drafts are unavailable until the AI provider gate is closed.</p>}
        </nav>
      )}
      <ContentEditor key={`${mode}-${source?.id ?? "new"}`} mode={mode} action={action} targets={workspace.targets} guidance={workspace.guidance} policies={workspace.policies} media={workspace.media} source={source} />
    </>
  );
}
