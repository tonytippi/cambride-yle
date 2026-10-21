"use client";
import { useActionState } from "react";
import type { ArchiveActionState } from "@/app/(staff)/academic-lead/archive/actions";
import { paperLabel, statusLabel } from "@/features/content/ui/labels";

/* eslint-disable no-unused-vars */
type Action = (state: ArchiveActionState, data: FormData) => Promise<ArchiveActionState>;
/* eslint-enable no-unused-vars */
type ArchiveSet = { id: string; title: string; paper: string; part: string; status: string; approvedBy: string | null; questionCount: number; localStatus?: string };
type Archive = { sets: ArchiveSet[]; looseQuestions: number; totals: { questions: number; media: number; missing: number } };

function Outcome({ state }: { state: ArchiveActionState }) {
  const report = state.importReport;
  return (
    <>
      {state.error && <p role="alert" className="error">{state.error.message}</p>}
      {state.success && <p role="status" className="notice">{state.success}</p>}
      {report && report.failed.length > 0 && (
        <div role="alert">
          <h3>Not imported</h3>
          <ul>{report.failed.map((item) => <li key={`${item.kind}-${item.id}`}><strong>{item.label}</strong>: {item.message}</li>)}</ul>
        </div>
      )}
      {report && report.warnings.length > 0 && (
        <>
          <h3>Warnings</h3>
          <ul>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </>
      )}
      {state.pushReport && state.pushReport.failed.length > 0 && (
        <div role="alert">
          <h3>Not pushed</h3>
          <ul>{state.pushReport.failed.map((item) => <li key={item.key}>{item.key}: {item.message}</li>)}</ul>
        </div>
      )}
    </>
  );
}

export function ArchivePanel({ archive, importAction, pushAction }: { archive: Archive; importAction: Action; pushAction: Action }) {
  const [importState, importFormAction, importing] = useActionState(importAction, {});
  const [pushState, pushFormAction, pushing] = useActionState(pushAction, {});
  return (
    <>
      <section className="staff-section" aria-labelledby="archive-import-heading">
        <h2 id="archive-import-heading">Bring content into this database</h2>
        <p className="field-hint">
          {archive.sets.length} practice sets, {archive.totals.questions} questions and {archive.totals.media} pictures or sounds in the archive; {archive.totals.missing} are not in this database yet.
          Approved and published content keeps its status. You can still revise it afterwards.
        </p>
        <form action={importFormAction} className="action-form">
          {archive.sets.length === 0 ? <p>The archive has no practice sets yet.</p> : (
            <fieldset>
              <legend>Practice sets</legend>
              <div className="library-list">
                {archive.sets.map((set) => (
                  <label key={set.id} className={`library-item status-${set.status}`}>
                    <input type="checkbox" name="practiceSetIds" value={set.id} disabled={Boolean(set.localStatus)} />{" "}
                    <strong>{set.title}</strong>{" "}
                    <span className={`badge status ${set.status}`}>{statusLabel(set.status)}</span>
                    <span className="meta"> · {paperLabel(set.paper, set.part)} · {set.questionCount} questions{set.approvedBy ? ` · approved by ${set.approvedBy}` : ""}</span>
                    {set.localStatus && <span className="field-hint"> · Already in this database ({statusLabel(set.localStatus)})</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {archive.looseQuestions > 0 && <p className="field-hint">{archive.looseQuestions} questions are not in any set; Import all brings them too.</p>}
          <div className="dialog-actions">
            <button name="intent" value="selected" disabled={importing || archive.sets.length === 0}>{importing ? "Importing..." : "Import selected"}</button>
            <button name="intent" value="all" className="secondary" disabled={importing}>{importing ? "Importing..." : "Import all"}</button>
          </div>
          <Outcome state={importState} />
        </form>
      </section>
      <section className="staff-section" aria-labelledby="archive-push-heading">
        <h2 id="archive-push-heading">Push this database to the archive</h2>
        <p className="field-hint">Use this after a failed automatic push, or to fill a new archive. A version already further along in the archive keeps that status.</p>
        <form action={pushFormAction} className="action-form">
          <button className="secondary" disabled={pushing}>{pushing ? "Pushing..." : "Push all to archive"}</button>
          <Outcome state={pushState} />
        </form>
      </section>
    </>
  );
}
