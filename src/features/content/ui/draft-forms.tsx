"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
import type { ContentActionState } from "@/app/academic-lead/actions";
/* eslint-disable no-unused-vars */
type Action = (
  state: ContentActionState,
  data: FormData,
) => Promise<ContentActionState>;
/* eslint-enable no-unused-vars */
type Shared = {
  targets: { id: string; canonicalId: string }[];
  guidance: { id: string; topic: string }[];
  policies: { currentVersionId: string | null; canonicalId: string }[];
  media: { id: string; mediaType: string; status: string; paper: string; part: string; engine: string }[];
};
function Status({ state }: { state: ContentActionState }) {
  return (
    <>
      {state.error && (
        <div role="alert" className="error">
          <strong>{state.error.code}:</strong> {state.error.message}
          {state.error.findings?.map((finding) => (
            <p key={`${finding.field}-${finding.code}`}>
              {finding.field}: {finding.code}
            </p>
          ))}
        </div>
      )}
      {state.success && (
        <p role="status" className="notice">
          {state.success}
        </p>
      )}
    </>
  );
}
function SharedFields({ targets, guidance }: Omit<Shared, "policies" | "media">) {
  return (
    <>
      <label>
        Paper
        <select name="paper">
          <option value="reading_writing">Reading and Writing</option>
          <option value="listening">Listening</option>
        </select>
      </label>
      <label>
        Part
        <input
          name="part"
          type="number"
          min="1"
          max="5"
          defaultValue="1"
          required
        />
      </label>
      <label>
        P0 engine
        <select name="engine">
          <option value="picture_true_false">Picture true/false</option>
          <option value="picture_yes_no">Picture yes/no</option>
          <option value="audio_picture_choice">Audio picture choice</option>
          <option value="audio_note_taking">Audio note taking</option>
          <option value="word_bank_cloze">Word bank cloze</option>
        </select>
      </label>
      <label>
        Primary target
        <select name="primaryTargetId" required>
          <option value="">Choose a target</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.canonicalId}
            </option>
          ))}
        </select>
      </label>
      <label>
        Topic target
        <select name="topicId" required>
          <option value="">Choose a topic</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.canonicalId}
            </option>
          ))}
        </select>
      </label>
      <label>
        Supporting target IDs, comma separated
        <input name="supportingTargetIds" />
      </label>
      <label>
        Spelling evidence tags, comma separated (optional)
        <input name="spelling" />
      </label>
      <label>
        Colour evidence tags, comma separated (optional)
        <input name="colours" />
      </label>
      <label>
        Position evidence tags, comma separated (optional)
        <input name="positions" />
      </label>
      <label>
        Task guidance
        <select name="guidanceId" required>
          <option value="">Choose guidance</option>
          {guidance.map((item) => (
            <option key={item.id} value={item.id}>
              {item.topic}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estimated duration in seconds
        <input
          name="estimatedDurationSeconds"
          type="number"
          min="1"
          defaultValue="60"
          required
        />
      </label>
      <label>
        Alternative text for staff review
        <input name="altText" required />
      </label>
      <label>
        Picture-choice label (optional unless used for audio picture choice)
        <input name="choiceLabel" />
      </label>
      <label>
        Source reference
        <input name="source" required />
      </label>
      <label>
        Rights or licence reference
        <input name="rightsReference" required />
      </label>
    </>
  );
}
function QuestionFields({ policies, media }: Pick<Shared, "policies" | "media">) {
  return (
    <>
      <label>
        Answer policy version
        <select name="answerPolicyVersionId" required>
          <option value="">Choose an answer policy</option>
          {policies
            .filter((policy) => policy.currentVersionId)
            .map((policy) => (
              <option
                key={policy.currentVersionId}
                value={policy.currentVersionId!}
              >
                {policy.canonicalId}
              </option>
            ))}
        </select>
      </label>
      <label>
        Prompt
        <textarea name="prompt" required />
      </label>
      <label>
        Options, one per line
        <textarea name="options" required />
      </label>
      <label>
        Post-submission learning hint, English (optional)
        <textarea name="postSubmitHint" />
      </label>
      <label>
        Associated media versions
        <select name="mediaIds" multiple size={5}>
          {media.map((item) => <option key={item.id} value={item.id}>{item.mediaType} · {item.status} · {item.paper.replace("_", " ")} Part {item.part} · {item.engine} · {item.id}</option>)}
        </select>
      </label>
      <details>
        <summary>Association rules</summary>
        <p>Select only media matching the question paper, part and engine. Draft and approved media may be selected; retired media is rejected.</p>
      </details>
    </>
  );
}
function MediaFields() {
  return (
    <>
      <label>
        Media type
        <select name="mediaType">
          <option value="image">Image</option>
          <option value="audio">Audio</option>
        </select>
      </label>
      <label>
        Preview URL (optional)
        <input name="previewUrl" type="url" />
      </label>
      <label>
        Description
        <textarea name="description" required />
      </label>
    </>
  );
}
function Form({
  title,
  pendingLabel,
  action,
  children,
}: {
  title: string;
  pendingLabel: string;
  action: Action;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="sign-in-form content-form">
      <h2>{title}</h2>
      {children}
      <Status state={state} />
      <button disabled={pending}>{pending ? pendingLabel : title}</button>
    </form>
  );
}
export function ContentDraftForms({
  questionAction,
  mediaAction,
  aiAction,
  aiEnabled,
  ...shared
}: Shared & { questionAction: Action; mediaAction: Action; aiAction: Action; aiEnabled: boolean }) {
  const references = (
    <label>
      Permitted controlled target IDs, one per line
      <textarea name="permittedReferences" />
    </label>
  );
  return (
    <div className="content-forms">
      <Form
        title="Save manual question draft"
        pendingLabel="Saving question draft..."
        action={questionAction}
      >
        <p>Every saved record remains a draft for later academic review.</p>
        <label>Source question draft ID to revise (optional)<input name="sourceId" /></label>
        <SharedFields {...shared} />
        <QuestionFields policies={shared.policies} media={shared.media} />
      </Form>
      <Form
        title="Save manual media draft"
        pendingLabel="Saving media draft..."
        action={mediaAction}
      >
        <p>Every saved record remains a draft for later academic review.</p>
        <label>Source media draft ID to revise (optional)<input name="sourceId" /></label>
        <SharedFields {...shared} />
        <MediaFields />
      </Form>
      {aiEnabled ? <Form
        title="Request AI text draft"
        pendingLabel="Requesting text draft..."
        action={aiAction}
      >
        <input type="hidden" name="draftType" value="question" />
        <input type="hidden" name="kind" value="text" />
        <SharedFields {...shared} />
        <QuestionFields policies={shared.policies} media={shared.media} />
        <label>
          Source question draft ID to rerun (optional)
          <input name="sourceId" />
        </label>
        {references}
        <label>
          Staff prompt
          <textarea name="staffPrompt" required />
        </label>
      </Form> : <p className="notice">AI draft generation is unavailable until the provider gate is closed.</p>}
      {aiEnabled && <Form
        title="Request AI image draft"
        pendingLabel="Requesting image draft..."
        action={aiAction}
      >
        <input type="hidden" name="draftType" value="media" />
        <input type="hidden" name="kind" value="image" />
        <SharedFields {...shared} />
        <MediaFields />
        <label>
          Source media draft ID to rerun (optional)
          <input name="sourceId" />
        </label>
        {references}
        <label>
          Staff prompt
          <textarea name="staffPrompt" required />
        </label>
      </Form>}
    </div>
  );
}
export function ContentWorkflowControls({
  kind,
  mediaType,
  targetId,
  status,
  validateAction,
  submitAction,
  approveAction,
  publishAction,
  retireAction,
  rejectAction,
  exceptionAction,
  previewAction,
}: {
  kind: "question" | "media";
  mediaType?: "image" | "audio";
  targetId: string;
  status: "draft" | "in_review" | "approved" | "published" | "retired";
  validateAction: Action;
  submitAction: Action;
  approveAction: Action;
  publishAction?: Action;
  retireAction?: Action;
  rejectAction: Action;
  exceptionAction: Action;
  previewAction: Action;
}) {
  const fields = (
    <>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="targetId" value={targetId} />
    </>
  );
  return (
    <section
      className="workflow-controls"
      aria-label={`Review controls for ${targetId}`}
    >
      <p>
        <strong>Status:</strong> {status.replace("_", " ")}
      </p>
      {status === "draft" && (
        <Form
          title="Run validation"
          pendingLabel="Running validation..."
          action={validateAction}
        >
          {fields}
        </Form>
      )}
      {status === "draft" && (
        <>
          <Form
            title="Submit for review"
            pendingLabel="Submitting for review..."
            action={submitAction}
          >
            {fields}
          </Form>
          <Form
            title="Accept validation exception"
            pendingLabel="Recording exception..."
            action={exceptionAction}
          >
            {fields}
            <label>
              Exception reason
              <textarea name="reason" required />
            </label>
          </Form>
        </>
      )}
      {status === "in_review" && (
        <>
          {kind === "media" && mediaType === "image" && (
            <Form
              title="Confirm 375px phone preview"
              pendingLabel="Recording phone preview..."
              action={previewAction}
            >
              {fields}
              <p>Confirm that this image is usable at a 375px phone width.</p>
            </Form>
          )}
          <Form
            title="Approve content"
            pendingLabel="Approving content..."
            action={approveAction}
          >
            {fields}
          </Form>
          <Form
            title="Accept validation exception"
            pendingLabel="Recording exception..."
            action={exceptionAction}
          >
            {fields}
            <label>
              Exception reason
              <textarea name="reason" required />
            </label>
          </Form>
          <Form
            title="Reject content"
            pendingLabel="Rejecting content..."
            action={rejectAction}
          >
            {fields}
            <label>
              Rejection reason
              <textarea name="reason" required />
            </label>
          </Form>
        </>
      )}
      {status === "approved" && publishAction && (
        <Form
          title="Publish content"
          pendingLabel="Publishing content..."
          action={publishAction}
        >
          {fields}
        </Form>
      )}
      {status === "published" && retireAction && (
        <Form
          title="Retire content"
          pendingLabel="Retiring content..."
          action={retireAction}
        >
          {fields}
        </Form>
      )}
    </section>
  );
}
export function PracticeSetComposer({
  action,
  questions,
  media,
}: {
  action: Action;
  questions: { id: string; engine: string }[];
  media: { id: string; mediaType: string }[];
}) {
  return (
    <Form
      title="Create practice-set draft"
      pendingLabel="Creating practice-set draft..."
      action={action}
    >
      <p>
        Choose source question versions. Publication requires published sources,
        one paper/part, five to ten minutes and one or two objectives.
      </p>
      <label>
        Learner-facing title
        <input name="title" maxLength={120} required />
      </label>
      <label>
        Question IDs, comma separated
        <textarea name="questionIds" required />
      </label>
      <p>Associated media is taken from each question version and cannot be changed here.</p>
      <details>
        <summary>Published library IDs</summary>
        <p>
          Questions:{" "}
          {questions.map((item) => `${item.engine}: ${item.id}`).join("; ") ||
            "None"}
        </p>
        <p>
          Media:{" "}
          {media.map((item) => `${item.mediaType}: ${item.id}`).join("; ") ||
            "None"}
        </p>
      </details>
    </Form>
  );
}
export function PracticeSetRetireControl({
  practiceSetId,
  action,
}: {
  practiceSetId: string;
  action: Action;
}) {
  return (
    <Form
      title="Retire practice set"
      pendingLabel="Retiring practice set..."
      action={action}
    >
      <input type="hidden" name="practiceSetId" value={practiceSetId} />
      <p>
        Retired sets remain immutable staff evidence and cannot be selected
        again.
      </p>
    </Form>
  );
}
export function PracticeSetWorkflowControls({ practiceSetId, status, submitAction, approveAction, publishAction, retireAction }: { practiceSetId: string; status: "draft" | "in_review" | "approved" | "published" | "retired"; submitAction: Action; approveAction: Action; publishAction: Action; retireAction: Action }) {
  const action = status === "draft" ? submitAction : status === "in_review" ? approveAction : status === "approved" ? publishAction : status === "published" ? retireAction : undefined;
  const title = status === "draft" ? "Submit practice set for review" : status === "in_review" ? "Approve practice set" : status === "approved" ? "Publish practice set" : "Retire practice set";
  return action ? <Form title={title} pendingLabel={`${title}...`} action={action}><input type="hidden" name="practiceSetId" value={practiceSetId} /></Form> : <p>This immutable practice set has been retired.</p>;
}
