"use client";
import { useActionState, useState } from "react";
import type { ContentActionState } from "@/app/academic-lead/actions";
import { engineLabel, minutes, paperLabel } from "./labels";

/* eslint-disable no-unused-vars */
type Action = (state: ContentActionState, data: FormData) => Promise<ContentActionState>;
/* eslint-enable no-unused-vars */
export type ComposerQuestion = { id: string; prompt: string; engine: string; paper: string; part: string; durationSeconds: number; primaryTargetId: string; objective: string; topic: string; mediaCount: number };

/* Mirrors the server composition rules so staff see problems before saving; the server still decides. */
export function compositionChecks(selected: ComposerQuestion[]) {
  const duration = selected.reduce((total, question) => total + question.durationSeconds, 0);
  const scopes = new Set(selected.map((question) => `${question.paper}:${question.part}`));
  const objectives = new Set(selected.map((question) => question.primaryTargetId));
  return {
    duration,
    checks: [
      { ok: selected.length > 0, label: selected.length ? `${selected.length} question${selected.length === 1 ? "" : "s"} chosen` : "Choose at least one question" },
      { ok: duration >= 300 && duration <= 600, label: `Total time ${minutes(duration)} (must be 5–10 minutes)` },
      { ok: selected.length > 0 && scopes.size === 1, label: scopes.size > 1 ? "Questions come from different papers or parts; use one" : "One paper and part" },
      { ok: objectives.size >= 1 && objectives.size <= 2, label: `${objectives.size} main objective${objectives.size === 1 ? "" : "s"} (must be 1 or 2)` },
    ],
  };
}

export function SetComposer({ action, questions }: { action: Action; questions: ComposerQuestion[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [chosen, setChosen] = useState<string[]>([]);
  const selected = questions.filter((question) => chosen.includes(question.id));
  const { checks } = compositionChecks(selected);
  const groups = [...new Map(questions.map((question) => [`${question.paper}:${question.part}:${question.engine}`, questions.filter((entry) => entry.paper === question.paper && entry.part === question.part && entry.engine === question.engine)])).entries()];
  const toggle = (id: string, on: boolean) => setChosen((current) => (on ? [...current, id] : current.filter((entry) => entry !== id)));
  return (
    <form action={formAction} className="staff-form set-composer">
      <label>
        Title learners see
        <input name="title" maxLength={120} required />
      </label>
      {questions.length === 0 ? (
        <p className="notice">No published questions yet. Publish questions in the content library first.</p>
      ) : groups.map(([key, group]) => (
        <fieldset key={key} className="choice-list">
          <legend>{paperLabel(group[0]!.paper, group[0]!.part)} · {engineLabel(group[0]!.engine)}</legend>
          {group.map((question) => (
            <label key={question.id} className="check question-choice">
              <input type="checkbox" name="questionIds" value={question.id} checked={chosen.includes(question.id)} onChange={(event) => toggle(question.id, event.target.checked)} />
              <span>{question.prompt}<span className="field-hint"> · {question.topic} · {question.objective} · {minutes(question.durationSeconds)}{question.mediaCount ? ` · ${question.mediaCount} media` : ""}</span></span>
            </label>
          ))}
        </fieldset>
      ))}
      <ul className="composition-checks" aria-live="polite" aria-label="Set checks">
        {checks.map((check) => <li key={check.label} className={check.ok ? "ok" : "problem"}><span aria-hidden="true">{check.ok ? "✓" : "!"}</span> {check.label}</li>)}
      </ul>
      {state.error && <div role="alert" className="error"><p><strong>{state.error.message}</strong></p>{state.error.findings?.length ? <ul>{state.error.findings.map((finding) => <li key={finding.code}>{finding.message}</li>)}</ul> : null}</div>}
      {state.success && <p role="status" className="notice">{state.success}</p>}
      <button disabled={pending || selected.length === 0}>{pending ? "Creating practice-set draft…" : "Create practice-set draft"}</button>
    </form>
  );
}
