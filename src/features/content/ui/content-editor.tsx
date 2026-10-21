"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { ContentActionState } from "@/app/(staff)/academic-lead/actions";
import { engineLabel, paperLabel, statusLabel } from "./labels";

/* eslint-disable no-unused-vars */
type Action = (state: ContentActionState, data: FormData) => Promise<ContentActionState>;
/* eslint-enable no-unused-vars */
export type EditorTarget = { id: string; canonicalId: string; category: string; guidance: string; isApproved: boolean };
export type EditorGuidance = { id: string; paper: string; part: number; engine: string; topic: string; taskFormat: string; maxWords: number; maxOptions: number };
export type EditorPolicy = { canonicalId: string; currentVersionId: string | null; guidanceId: string };
export type EditorMedia = { id: string; mediaType: string; status: string; paper: string; part: string; engine: string; description: string; hasFile: boolean; choiceLabel?: string };
export type EditorMode = "question" | "media" | "ai-text" | "ai-image";
/* Prefill for a revision of an existing version; the revision is always saved as a new draft. */
export type EditorSource = {
  id: string; guidanceId: string; primaryTargetId: string; topicId?: string; supportingTargetIds: string[]; estimatedDurationSeconds: number;
  altText: string; choiceLabel?: string; source: string; rightsReference: string; spelling: string[]; colours: string[]; positions: string[];
  answerPolicyVersionId?: string; prompt?: string; options?: string[]; postSubmitHint?: string; mediaIds?: string[];
  mediaType?: string; description?: string; previewUrl?: string; hasFile?: boolean;
};

const titles: Record<EditorMode, string> = { question: "Save question draft", media: "Save media draft", "ai-text": "Request AI question draft", "ai-image": "Request AI picture draft" };
const optionHints: Record<string, string> = {
  picture_true_false: "Usually two options: true and false.",
  picture_yes_no: "Usually two options: yes and no.",
  audio_picture_choice: "One option per picture; each must match a picture's choice label.",
  audio_note_taking: "A short instruction such as “Listen and write”. Never include the answer.",
  word_bank_cloze: "The words in the word bank, one per line.",
};
const short = (text: string, length = 60) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);
const targetLabel = (target: EditorTarget) => `${target.canonicalId} — ${short(target.guidance)}`;

function Status({ state }: { state: ContentActionState }) {
  if (state.error)
    return (
      <div role="alert" className="error">
        <p><strong>{state.error.message}</strong></p>
        {state.error.findings?.length ? <ul>{state.error.findings.map((finding) => <li key={`${finding.field}-${finding.code}`}>{finding.message} <span className="field-hint">({finding.field}, {finding.code})</span></li>)}</ul> : null}
      </div>
    );
  if (state.success) return <p role="status" className="notice">{state.success} <Link href="/academic-lead/content">Open the content library</Link></p>;
  return null;
}

export function ContentEditor({ mode, action, targets, guidance, policies, media, source }: { mode: EditorMode; action: Action; targets: EditorTarget[]; guidance: EditorGuidance[]; policies: EditorPolicy[]; media: EditorMedia[]; source?: EditorSource }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [guidanceId, setGuidanceId] = useState(source?.guidanceId ?? "");
  const [primaryTargetId, setPrimaryTargetId] = useState(source?.primaryTargetId ?? "");
  const [mediaType, setMediaType] = useState(source?.mediaType ?? (mode === "ai-image" ? "image" : "image"));
  const task = guidance.find((item) => item.id === guidanceId);
  const question = mode === "question" || mode === "ai-text";
  const approved = targets.filter((target) => target.isApproved);
  const topics = approved.filter((target) => target.category === "topic");
  const objectives = approved.filter((target) => target.category !== "topic");
  const scopedPolicies = policies.filter((policy) => policy.currentVersionId && policy.guidanceId === guidanceId);
  const scopedMedia = task ? media.filter((item) => item.paper === task.paper && item.part === String(task.part) && item.engine === task.engine && item.status !== "retired") : [];
  return (
    <form action={formAction} className="staff-form content-editor">
      {source && <input type="hidden" name="sourceId" value={source.id} />}
      {mode === "ai-text" && <><input type="hidden" name="draftType" value="question" /><input type="hidden" name="kind" value="text" /></>}
      {mode === "ai-image" && <><input type="hidden" name="draftType" value="media" /><input type="hidden" name="kind" value="image" /><input type="hidden" name="mediaType" value="image" /></>}
      {task && <><input type="hidden" name="paper" value={task.paper} /><input type="hidden" name="part" value={task.part} /><input type="hidden" name="engine" value={task.engine} /></>}

      <fieldset>
        <legend>1. Task type</legend>
        <label>
          Task guidance
          <select name="guidanceId" required value={guidanceId} onChange={(event) => setGuidanceId(event.target.value)}>
            <option value="">Choose the task this content is for</option>
            {guidance.map((item) => <option key={item.id} value={item.id}>{paperLabel(item.paper, item.part)} · {engineLabel(item.engine)} · {item.topic} ({item.taskFormat})</option>)}
          </select>
        </label>
        {task ? <p className="field-hint">Paper, part and engine come from this guidance. Prompts may use up to {task.maxWords} words and {task.maxOptions} options.</p> : guidance.length === 0 ? <p className="field-hint">No task guidance yet. <Link href="/academic-lead/curriculum">Add guidance in Curriculum</Link> first.</p> : null}
      </fieldset>

      <fieldset>
        <legend>2. Curriculum targets</legend>
        <label>
          Topic
          <select name="topicId" required defaultValue={source?.topicId ?? ""}>
            <option value="">Choose a topic</option>
            {topics.map((target) => <option key={target.id} value={target.id}>{targetLabel(target)}</option>)}
          </select>
        </label>
        <label>
          Main learning objective
          <select name="primaryTargetId" required value={primaryTargetId} onChange={(event) => setPrimaryTargetId(event.target.value)}>
            <option value="">Choose the objective this assesses</option>
            {objectives.map((target) => <option key={target.id} value={target.id}>{targetLabel(target)}</option>)}
          </select>
        </label>
        {objectives.length > 1 && (
          <details className="choice-list" open={Boolean(source?.supportingTargetIds.length)}>
            <summary>Supporting objectives (optional)</summary>
            {objectives.filter((target) => target.id !== primaryTargetId).map((target) => (
              <label key={target.id} className="check"><input type="checkbox" name="supportingTargetIds" value={target.id} defaultChecked={source?.supportingTargetIds.includes(target.id)} /> {targetLabel(target)}</label>
            ))}
          </details>
        )}
        {(topics.length === 0 || objectives.length === 0) && <p className="field-hint">You need at least one approved topic and one approved objective. <Link href="/academic-lead/curriculum">Add targets in Curriculum</Link>.</p>}
      </fieldset>

      {question ? (
        <fieldset>
          <legend>3. Question</legend>
          <label>
            Answer policy
            <select name="answerPolicyVersionId" required defaultValue={source?.answerPolicyVersionId ?? ""}>
              <option value="">{task ? "Choose the answer policy" : "Choose task guidance first"}</option>
              {scopedPolicies.map((policy) => <option key={policy.currentVersionId} value={policy.currentVersionId!}>{policy.canonicalId}</option>)}
            </select>
          </label>
          {task && scopedPolicies.length === 0 && <p className="field-hint">No answer policy for this task yet. <Link href="/academic-lead/curriculum">Add one in Curriculum</Link>.</p>}
          <label>
            {mode === "ai-text" ? "Starting prompt (the AI may rewrite it)" : "Prompt learners see"}
            <textarea name="prompt" required defaultValue={source?.prompt} />
          </label>
          <label>
            Options, one per line
            <textarea name="options" required defaultValue={source?.options?.join("\n")} />
          </label>
          {task && <p className="field-hint">{optionHints[task.engine]}</p>}
          <label>
            Hint shown after submission (optional)
            <textarea name="postSubmitHint" defaultValue={source?.postSubmitHint} />
          </label>
          <fieldset className="choice-list media-choices">
            <legend>Pictures and sounds</legend>
            {!task ? <p className="field-hint">Choose task guidance to see matching media.</p> : scopedMedia.length === 0 ? <p className="field-hint">No media for {paperLabel(task.paper, task.part)} · {engineLabel(task.engine)} yet. <Link href="/academic-lead/content/new?type=media">Create media</Link> first.</p> : scopedMedia.map((item) => (
              <label key={item.id} className="check media-choice">
                <input type="checkbox" name="mediaIds" value={item.id} defaultChecked={source?.mediaIds?.includes(item.id)} />
                {item.hasFile && item.mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, uncached staff preview
                  <img src={`/api/content/media/${item.id}`} alt="" width={64} height={64} loading="lazy" />
                ) : <span className="media-icon" aria-hidden="true">{item.mediaType === "audio" ? "♪" : "▢"}</span>}
                <span>{item.description}<span className="field-hint"> · {item.mediaType === "audio" ? "Sound" : "Picture"} · {statusLabel(item.status)}{item.choiceLabel ? ` · label “${item.choiceLabel}”` : ""}{item.hasFile ? "" : " · no file"}</span></span>
              </label>
            ))}
          </fieldset>
        </fieldset>
      ) : (
        <fieldset>
          <legend>3. {mode === "ai-image" ? "Picture" : "Picture or sound"}</legend>
          {mode === "media" && (
            <label>
              Media type
              <select name="mediaType" value={mediaType} onChange={(event) => setMediaType(event.target.value)}>
                <option value="image">Picture</option>
                <option value="audio">Sound</option>
              </select>
            </label>
          )}
          <label>
            {mode === "ai-image" ? "What the picture shows" : "Description for staff"}
            <textarea name="description" required defaultValue={source?.description} />
          </label>
          {mode === "media" && (
            <>
              <label>
                {source?.hasFile ? "Replace file (optional)" : "File"}
                <input name="file" type="file" accept={mediaType === "audio" ? "audio/mpeg,audio/wav,audio/ogg,audio/mp4" : "image/png,image/jpeg,image/webp"} required={!source?.hasFile} />
              </label>
              <p className="field-hint">{mediaType === "audio" ? "MP3, WAV, OGG or M4A, up to 15 MB." : "PNG, JPEG or WebP, up to 5 MB."}{source?.hasFile ? " Leave empty to keep the current file." : ""}</p>
              <details>
                <summary>External reference link (optional)</summary>
                <label>Preview URL<input name="previewUrl" type="url" defaultValue={source?.previewUrl} /></label>
              </details>
            </>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>4. Accessibility and source</legend>
        <label>
          Alternative text
          <input name="altText" required defaultValue={source?.altText} />
        </label>
        <p className="field-hint">Describe what is shown without giving away the answer.</p>
        {(task?.engine === "audio_picture_choice" || !task) && !question && (
          <label>
            Picture-choice label (for listen-and-choose pictures)
            <input name="choiceLabel" defaultValue={source?.choiceLabel} />
          </label>
        )}
        <label>
          Estimated time in seconds
          <input name="estimatedDurationSeconds" type="number" min="1" required defaultValue={source?.estimatedDurationSeconds ?? 60} />
        </label>
        <p className="field-hint">A practice set must add up to 5–10 minutes.</p>
        <label>
          Source
          <input name="source" required defaultValue={source?.source ?? "Centre-created original content"} />
        </label>
        <label>
          Rights or licence reference
          <input name="rightsReference" required defaultValue={source?.rightsReference ?? "Centre-owned"} />
        </label>
        <details>
          <summary>Optional evidence tags</summary>
          <label>Spelling, comma separated<input name="spelling" defaultValue={source?.spelling.join(", ")} /></label>
          <label>Colours, comma separated<input name="colours" defaultValue={source?.colours.join(", ")} /></label>
          <label>Positions, comma separated<input name="positions" defaultValue={source?.positions.join(", ")} /></label>
        </details>
      </fieldset>

      {(mode === "ai-text" || mode === "ai-image") && (
        <fieldset>
          <legend>5. Instructions for the AI</legend>
          <label>
            Prompt for the AI
            <textarea name="staffPrompt" required />
          </label>
          {objectives.length > 0 && (
            <details className="choice-list">
              <summary>Curriculum targets the AI may use (optional)</summary>
              {approved.map((target) => <label key={target.id} className="check"><input type="checkbox" name="permittedReferences" value={`${target.id}|${target.canonicalId}: ${short(target.guidance, 200)}`} /> {targetLabel(target)}</label>)}
            </details>
          )}
          <p className="field-hint">The result is saved as a draft and still needs validation, review and approval.</p>
        </fieldset>
      )}

      <Status state={state} />
      <button disabled={pending}>{pending ? (mode.startsWith("ai") ? "Waiting for the AI…" : "Saving…") : source ? `${titles[mode]} as a new revision` : titles[mode]}</button>
    </form>
  );
}
