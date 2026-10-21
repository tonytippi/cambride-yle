import { PracticeSetWorkflowControls } from "@/features/content/ui/draft-forms";
import { minutes, paperLabel, statusLabel } from "@/features/content/ui/labels";
import { SetComposer, type ComposerQuestion } from "@/features/content/ui/set-composer";
import { approvePracticeSetAction, createPracticeSetDraftAction, publishPracticeSetAction, retirePracticeSetAction, submitPracticeSetForReviewAction } from "../actions";
import { loadWorkspace } from "../workspace";

const steps: Record<string, string> = { draft: "Submit for review", in_review: "Approve it", approved: "Publish so learners can choose it", published: "Live for learners", retired: "No longer offered; kept as history" };

export default async function PracticeSets() {
  const { drafts, targetName, guidanceOf } = await loadWorkspace();
  const questions: ComposerQuestion[] = drafts.questions.filter((item) => item.status === "published").map((item) => ({
    id: item.id, prompt: item.prompt, engine: item.engine, paper: item.paper, part: item.part, durationSeconds: Number(item.estimatedDurationSeconds), primaryTargetId: item.primaryTargetId,
    objective: targetName(item.primaryTargetId), topic: guidanceOf(item.guidanceId)?.topic ?? "", mediaCount: drafts.associations.filter((entry) => entry.questionVersionId === item.id).length,
  }));
  return (
    <>
      <h1>Practice sets</h1>
      <section className="staff-section" aria-labelledby="compose-heading">
        <h2 id="compose-heading">Compose a new set</h2>
        <p>Choose published questions from one paper and part. Their pictures and sounds come with them.</p>
        <SetComposer action={createPracticeSetDraftAction} questions={questions} />
      </section>
      <section className="staff-section" aria-labelledby="sets-heading">
        <h2 id="sets-heading">All sets</h2>
        {drafts.sets.length === 0 && <p>No practice sets yet.</p>}
        <div className="library-list">
          {drafts.sets.map((set) => (
            <article key={set.id} className={`library-item status-${set.status}`} aria-labelledby={`set-${set.id}`}>
              <p className="badges"><span className={`badge status ${set.status}`}>{statusLabel(set.status)}</span></p>
              <h3 id={`set-${set.id}`}>{set.title}</h3>
              <p className="meta">{paperLabel(set.paper, set.part)} · {minutes(set.estimatedDurationSeconds)} · {(set.primaryTargetIds as string[]).map(targetName).join(", ")}</p>
              <p className="next-step"><strong>Next step:</strong> {steps[set.status]}</p>
              <PracticeSetWorkflowControls practiceSetId={set.id} status={set.status} submitAction={submitPracticeSetForReviewAction} approveAction={approvePracticeSetAction} publishAction={publishPracticeSetAction} retireAction={retirePracticeSetAction} />
              <details className="history">
                <summary>History and details</summary>
                <p className="field-hint">ID: {set.id}</p>
                <ul className="audit-history" aria-label="Practice-set review and audit history">
                  {drafts.setReviews.filter((record) => record.practiceSetId === set.id).map((record) => <li key={record.id}>Review: {record.decision}, {record.createdAt.toLocaleString("en-GB")}</li>)}
                  {drafts.setAudits.filter((record) => record.practiceSetId === set.id).map((record) => <li key={record.id}>{record.action.replaceAll("_", " ").toLocaleLowerCase("en-GB")}, {record.createdAt.toLocaleString("en-GB")}</li>)}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
