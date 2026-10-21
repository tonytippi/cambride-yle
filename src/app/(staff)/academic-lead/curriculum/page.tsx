import { GuidanceEditForm, GuidanceForm, PolicyForm, TargetEditForm, TargetForm } from "@/features/curriculum/ui/catalogue-forms";
import { engineLabel, paperLabel } from "@/features/content/ui/labels";
import { createGuidanceAction, createPolicyAction, createTargetAction, updateGuidanceAction, updateTargetAction } from "../actions";
import { loadWorkspace } from "../workspace";

const categoryLabels: Record<string, string> = { topic: "Topics", vocabulary: "Vocabulary", grammar: "Grammar", language_target: "Language targets" };

export default async function Curriculum() {
  const { catalogue, targetName, guidanceOf } = await loadWorkspace();
  const categories = Object.keys(categoryLabels).filter((category) => catalogue.targets.some((target) => target.category === category));
  return (
    <>
      <h1>Curriculum</h1>
      <p>Internal targets, task guidance and answer policies that every question uses. Set these up first.</p>

      <section className="staff-section" aria-labelledby="targets-heading">
        <h2 id="targets-heading">Targets</h2>
        <p className="field-hint">Every question needs one approved topic and one approved learning objective.</p>
        <details className="add-panel"><summary>Add a target</summary><TargetForm action={createTargetAction} /></details>
        {catalogue.targets.length === 0 && <p>No targets yet.</p>}
        {categories.map((category) => (
          <div key={category}>
            <h3>{categoryLabels[category]}</h3>
            <ul className="catalogue-list">
              {catalogue.targets.filter((target) => target.category === category).map((target) => (
                <li key={target.id}>
                  <div><strong>{target.canonicalId}</strong> <span className={`badge ${target.isApproved ? "status published" : ""}`}>{target.isApproved ? "Approved" : "Not approved"}</span></div>
                  <p>{target.guidance}</p>
                  <details><summary>Edit</summary><TargetEditForm action={updateTargetAction} target={target} /></details>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="staff-section" aria-labelledby="guidance-heading">
        <h2 id="guidance-heading">Task guidance</h2>
        <p className="field-hint">One record per paper, part and task engine. It sets the word and option limits for its questions.</p>
        <details className="add-panel"><summary>Add task guidance</summary><GuidanceForm action={createGuidanceAction} /></details>
        {catalogue.guidance.length === 0 && <p>No task guidance yet.</p>}
        <ul className="catalogue-list">
          {catalogue.guidance.map((guidance) => (
            <li key={guidance.id}>
              <div><strong>{paperLabel(guidance.paper, guidance.part)} · {engineLabel(guidance.engine)}</strong></div>
              <p>{guidance.topic} · {guidance.taskFormat} · up to {guidance.maxWords} words and {guidance.maxOptions} options</p>
              <details><summary>Edit</summary><GuidanceEditForm action={updateGuidanceAction} guidance={{ ...guidance, approvedNames: guidance.approvedNames as string[], approvedNumbers: guidance.approvedNumbers as number[] }} /></details>
            </li>
          ))}
        </ul>
      </section>

      <section className="staff-section" aria-labelledby="policies-heading">
        <h2 id="policies-heading">Answer policies</h2>
        <p className="field-hint">The approved answer and how responses are matched. Saving creates a new immutable version; published questions keep the version they used.</p>
        <details className="add-panel"><summary>Add an answer policy or a new version</summary><PolicyForm action={createPolicyAction} targets={catalogue.targets} policies={catalogue.policies} guidance={catalogue.guidance} /></details>
        {catalogue.policies.length === 0 && <p>No answer policies yet.</p>}
        <ul className="catalogue-list">
          {catalogue.policies.map((policy) => {
            const current = policy.versions.find((version) => version.id === policy.currentVersionId);
            const task = guidanceOf(policy.guidanceId);
            return (
              <li key={policy.id}>
                <div><strong>{policy.canonicalId}</strong>{current && <span className="badge">Version {current.version}</span>}</div>
                <p>{task ? `${paperLabel(task.paper, task.part)} · ${engineLabel(task.engine)} · ${task.topic}` : "Unknown guidance"} · objective {targetName(policy.targetId)}</p>
                {current && <p>Answer: <strong>{String(current.canonicalAnswer)}</strong>{(current.acceptedAnswers as unknown[]).length ? ` (also accepts ${(current.acceptedAnswers as unknown[]).map(String).join(", ")})` : ""} · {current.inputKind.replace("_", "/")}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
