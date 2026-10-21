import Link from "next/link";
import { getContentReadiness } from "@/features/content/application/content";
import { engineLabel } from "@/features/content/ui/labels";
import { loadWorkspace } from "./workspace";

const statuses = ["draft", "in_review", "approved", "published"] as const;

export default async function AcademicLeadOverview() {
  const { actor, drafts, catalogue } = await loadWorkspace();
  const readiness = await getContentReadiness(actor);
  const content = [...drafts.questions.map((item) => ({ ...item, kind: "question" as const })), ...drafts.media.map((item) => ({ ...item, kind: "media" as const }))];
  const count = (status: string) => content.filter((item) => item.status === status).length;
  const setCount = (status: string) => drafts.sets.filter((set) => set.status === status).length;
  const covered = readiness.engines.filter((engine) => engine.covered).length;
  const steps = [
    { done: catalogue.targets.some((target) => target.category === "topic" && target.isApproved) && catalogue.targets.some((target) => target.category !== "topic" && target.isApproved), label: "Add approved topics and learning objectives", href: "/academic-lead/curriculum" },
    { done: catalogue.guidance.length > 0, label: "Add task guidance for each task type", href: "/academic-lead/curriculum" },
    { done: catalogue.policies.some((policy) => policy.currentVersionId), label: "Add answer policies", href: "/academic-lead/curriculum" },
    { done: drafts.media.some((item) => item.status === "published"), label: "Create and publish pictures and sounds", href: "/academic-lead/content/new?type=media" },
    { done: drafts.questions.some((item) => item.status === "published"), label: "Create and publish questions", href: "/academic-lead/content/new?type=question" },
    { done: drafts.sets.some((set) => set.status === "published"), label: "Compose and publish a practice set", href: "/academic-lead/sets" },
  ];
  return (
    <>
      <h1>Content overview</h1>
      <p>Drafts are internal until approved and published. This workspace makes no public curriculum claim.</p>
      <section aria-labelledby="attention-heading" className="staff-section">
        <h2 id="attention-heading">Needs attention</h2>
        <ul className="stat-grid">
          {statuses.map((status) => (
            <li key={status} className="stat-card">
              <Link href={`/academic-lead/content?status=${status}`}>
                <strong>{count(status)}</strong>
                <span>{status === "draft" ? "drafts to validate and submit" : status === "in_review" ? "items in review" : status === "approved" ? "approved items to publish" : "published items"}</span>
              </Link>
            </li>
          ))}
          <li className="stat-card">
            <Link href="/academic-lead/sets">
              <strong>{setCount("published")}</strong>
              <span>published practice sets{setCount("draft") + setCount("in_review") + setCount("approved") ? ` · ${setCount("draft") + setCount("in_review") + setCount("approved")} in progress` : ""}</span>
            </Link>
          </li>
          <li className="stat-card">
            <Link href="/academic-lead/readiness">
              <strong>{covered} of {readiness.engines.length}</strong>
              <span>task engines ready for the pilot</span>
            </Link>
          </li>
        </ul>
      </section>
      <section aria-labelledby="steps-heading" className="staff-section">
        <h2 id="steps-heading">Getting a practice set to learners</h2>
        <ol className="step-list">
          {steps.map((step) => (
            <li key={step.label} className={step.done ? "done" : undefined}>
              <span className="step-state">{step.done ? "Done" : "To do"}</span> <Link href={step.href}>{step.label}</Link>
            </li>
          ))}
        </ol>
        {readiness.engines.some((engine) => !engine.covered) && <p className="field-hint">Not yet ready: {readiness.engines.filter((engine) => !engine.covered).map((engine) => engineLabel(engine.engine)).join(", ")}.</p>}
      </section>
    </>
  );
}
