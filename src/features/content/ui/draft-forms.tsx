"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
import type { ContentActionState } from "@/app/(staff)/academic-lead/actions";
/* eslint-disable no-unused-vars */
type Action = (
  state: ContentActionState,
  data: FormData,
) => Promise<ContentActionState>;
/* eslint-enable no-unused-vars */
function Status({ state }: { state: ContentActionState }) {
  return (
    <>
      {state.error && (
        <div role="alert" className="error">
          <p><strong>{state.error.message}</strong></p>
          {state.error.findings?.length ? (
            <ul>
              {state.error.findings.map((finding) => (
                <li key={`${finding.field}-${finding.code}`}>{finding.message}</li>
              ))}
            </ul>
          ) : null}
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
/* One workflow transition: a labelled button, optional extra fields and its outcome. */
function ActionForm({
  title,
  pendingLabel,
  action,
  variant,
  children,
}: {
  title: string;
  pendingLabel: string;
  action: Action;
  variant?: "secondary" | "danger";
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="action-form" aria-label={title}>
      {children}
      <button className={variant} disabled={pending}>{pending ? pendingLabel : title}</button>
      <Status state={state} />
    </form>
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
  const exception = (
    <ActionForm title="Accept validation exception" pendingLabel="Recording exception..." action={exceptionAction} variant="secondary">
      {fields}
      <label>
        Exception reason
        <textarea name="reason" required />
      </label>
    </ActionForm>
  );
  return (
    <section className="workflow-controls" aria-label={`Review controls for ${targetId}`}>
      <div className="action-row">
        {status === "draft" && (
          <>
            <ActionForm title="Run validation" pendingLabel="Running validation..." action={validateAction} variant="secondary">{fields}</ActionForm>
            <ActionForm title="Submit for review" pendingLabel="Submitting for review..." action={submitAction}>{fields}</ActionForm>
          </>
        )}
        {status === "in_review" && (
          <>
            {kind === "media" && mediaType === "image" && (
              <ActionForm title="Confirm 375px phone preview" pendingLabel="Recording phone preview..." action={previewAction} variant="secondary">{fields}</ActionForm>
            )}
            <ActionForm title="Approve content" pendingLabel="Approving content..." action={approveAction}>{fields}</ActionForm>
          </>
        )}
        {status === "approved" && publishAction && (
          <ActionForm title="Publish content" pendingLabel="Publishing content..." action={publishAction}>{fields}</ActionForm>
        )}
      </div>
      {status === "in_review" && kind === "media" && mediaType === "image" && (
        <p className="field-hint">Check the picture at phone width (375px) before confirming the preview; approval needs it.</p>
      )}
      {(status === "draft" || status === "in_review" || (status === "published" && retireAction)) && (
        <details className="more-actions">
          <summary>More actions</summary>
          {(status === "draft" || status === "in_review") && exception}
          {status === "in_review" && (
            <ActionForm title="Reject content" pendingLabel="Rejecting content..." action={rejectAction} variant="danger">
              {fields}
              <label>
                Rejection reason
                <textarea name="reason" required />
              </label>
              <p className="field-hint">Rejection keeps this version and creates a new draft revision to fix.</p>
            </ActionForm>
          )}
          {status === "published" && retireAction && (
            <ActionForm title="Retire content" pendingLabel="Retiring content..." action={retireAction} variant="danger">
              {fields}
              <p className="field-hint">Retired content cannot be added to new sets. Published sets keep their copy.</p>
            </ActionForm>
          )}
        </details>
      )}
    </section>
  );
}
export function PracticeSetWorkflowControls({ practiceSetId, status, submitAction, approveAction, publishAction, retireAction }: { practiceSetId: string; status: "draft" | "in_review" | "approved" | "published" | "retired"; submitAction: Action; approveAction: Action; publishAction: Action; retireAction: Action }) {
  const action = status === "draft" ? submitAction : status === "in_review" ? approveAction : status === "approved" ? publishAction : status === "published" ? retireAction : undefined;
  const title = status === "draft" ? "Submit practice set for review" : status === "in_review" ? "Approve practice set" : status === "approved" ? "Publish practice set" : "Retire practice set";
  if (!action) return <p>This immutable practice set has been retired.</p>;
  const form = <ActionForm title={title} pendingLabel={`${title}...`} action={action} variant={status === "published" ? "danger" : undefined}><input type="hidden" name="practiceSetId" value={practiceSetId} /></ActionForm>;
  return status === "published" ? <details className="more-actions"><summary>More actions</summary>{form}<p className="field-hint">Learners with an open attempt can still finish it.</p></details> : form;
}
