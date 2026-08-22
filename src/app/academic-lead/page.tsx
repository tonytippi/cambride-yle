import Image from "next/image";
import { requireRole } from "@/features/identity/ui/session";
import { getCatalogue } from "@/features/curriculum/application/curriculum";
import {
  GuidanceEditForm,
  GuidanceForm,
  PolicyForm,
  TargetEditForm,
  TargetForm,
} from "@/features/curriculum/ui/catalogue-forms";
import { getContentDrafts, getContentReadiness } from "@/features/content/application/content";
import {
  ContentDraftForms,
  ContentWorkflowControls,
  PracticeSetComposer,
  PracticeSetWorkflowControls,
} from "@/features/content/ui/draft-forms";
import { ReadinessReport } from "@/features/content/ui/readiness-report";
import { serverConfig } from "@/shared/config/server";
import {
  acceptExceptionAction,
  approveContentAction,
  createGuidanceAction,
  createMediaDraftAction,
  createPolicyAction,
  createQuestionDraftAction,
  createTargetAction,
  phonePreviewAction,
  publishContentAction,
  approvePracticeSetAction,
  createPracticeSetDraftAction,
  publishPracticeSetAction,
  rejectContentAction,
  requestAiDraftAction,
  retireContentAction,
  retirePracticeSetAction,
  submitPracticeSetForReviewAction,
  submitForReviewAction,
  updateGuidanceAction,
  updateTargetAction,
  validateContentAction,
} from "./actions";

type Finding = { field: string; code: string; message: string };

export default async function AcademicLeadHome() {
  const actor = await requireRole(["academic_lead", "admin"]);
  const [catalogue, drafts, readiness] = await Promise.all([
    getCatalogue(actor),
    getContentDrafts(actor),
    getContentReadiness(actor),
  ]);
  const history = (kind: "question" | "media", id: string) => (
    <ul className="audit-history" aria-label="Validation and review history">
      {drafts.validations
        .filter((record) => record.kind === kind && record.targetId === id)
        .map((record) => (
          <li key={record.id}>
            Validation at {record.createdAt.toISOString()}
            <ul>
              {(record.findings as Finding[]).map((finding) => (
                <li key={`${finding.field}-${finding.code}`}>
                  {finding.field}: {finding.code} - {finding.message}
                </li>
              ))}
            </ul>
          </li>
        ))}
      {drafts.reviews
        .filter((record) => record.kind === kind && record.targetId === id)
        .map((record) => (
          <li key={record.id}>
            Review: {record.decision}
            {record.reason ? ` - ${record.reason}` : ""},{" "}
            {record.createdAt.toISOString()}
            <ul>
              {(record.findings as Finding[]).map((finding) => (
                <li key={`${finding.field}-${finding.code}`}>
                  {finding.field}: {finding.code} - {finding.message}
                </li>
              ))}
            </ul>
          </li>
        ))}
      {kind === "media" &&
        drafts.previews
          .filter((record) => record.targetId === id)
          .map((record) => (
            <li key={record.id}>
              Successful {record.viewportWidth}px phone preview,{" "}
              {record.createdAt.toISOString()}
            </li>
          ))}
    </ul>
  );
  const controls = (
    kind: "question" | "media",
    item: {
      id: string;
      status: "draft" | "in_review" | "approved" | "published" | "retired";
      mediaType?: string;
    },
  ) => (
    <>
      <ContentWorkflowControls
        kind={kind}
        mediaType={
          item.mediaType === "image" || item.mediaType === "audio"
            ? item.mediaType
            : undefined
        }
        targetId={item.id}
        status={item.status}
        validateAction={validateContentAction}
        submitAction={submitForReviewAction}
        approveAction={approveContentAction}
        publishAction={publishContentAction}
        retireAction={retireContentAction}
        rejectAction={rejectContentAction}
        exceptionAction={acceptExceptionAction}
        previewAction={phonePreviewAction}
      />
      {history(kind, item.id)}
    </>
  );
  const publishedQuestions = drafts.questions.filter(
    (item) => item.status === "published",
  );
  const publishedMedia = drafts.media.filter(
    (item) => item.status === "published",
  );
  const targetLabels = new Map(catalogue.targets.map((target) => [target.id, target.canonicalId]));

  return (
    <main className="shell">
      <section className="welcome catalogue">
        <p className="eyebrow">Internal staff content</p>
        <h1>Curriculum targets, policies and content drafts</h1>
        <p>
          Drafts are not approved or published. This workspace does not make a
          public curriculum claim.
        </p>
        <div className="catalogue-grid">
          <TargetForm action={createTargetAction} />
          <GuidanceForm action={createGuidanceAction} />
          <PolicyForm
            action={createPolicyAction}
            targets={catalogue.targets}
            policies={catalogue.policies}
            guidance={catalogue.guidance}
          />
        </div>
        <h2>Controlled targets</h2>
        <div className="account-list">
          {catalogue.targets.map((target) => (
            <article className="account-card" key={target.id}>
              <h3>{target.canonicalId}</h3>
              <p>
                {target.category} · {target.level} ·{" "}
                {target.isApproved ? "approved" : "not approved"}
              </p>
              <p>{target.guidance}</p>
              <TargetEditForm action={updateTargetAction} target={target} />
            </article>
          ))}
        </div>
        <h2>Internal task guidance</h2>
        <div className="account-list">
          {catalogue.guidance.map((guidance) => (
            <article className="account-card" key={guidance.id}>
              <h3>
                {guidance.paper.replace("_", " ")} Part {guidance.part}:{" "}
                {guidance.taskFormat}
              </h3>
              <p>
                {guidance.engine} · {guidance.topic}
              </p>
              <GuidanceEditForm
                action={updateGuidanceAction}
                guidance={{
                  ...guidance,
                  approvedNames: guidance.approvedNames as string[],
                  approvedNumbers: guidance.approvedNumbers as number[],
                }}
              />
            </article>
          ))}
        </div>
        <h2>Content drafts</h2>
        <ContentDraftForms
          questionAction={createQuestionDraftAction}
          mediaAction={createMediaDraftAction}
          aiAction={requestAiDraftAction}
          aiEnabled={serverConfig.AI_DRAFT_PROVIDER_GATE_CLOSED}
          targets={catalogue.targets}
          guidance={catalogue.guidance}
          policies={catalogue.policies}
          media={drafts.media}
        />
        <h2>Practice-set draft composer</h2>
        <PracticeSetComposer
          action={createPracticeSetDraftAction}
          questions={publishedQuestions}
          media={publishedMedia}
        />
        <h2>Pilot content readiness</h2>
        <ReadinessReport readiness={readiness} targetLabels={targetLabels} />
        <h2>Practice sets</h2>
        <div className="account-list">
          {drafts.sets.map((set) => (
            <article className="account-card" key={set.id}>
              <h3>Practice set: {set.id}</h3>
              <p>Status: {set.status}</p>
              <p>
                {set.paper.replace("_", " ")} Part {set.part} ·{" "}
                {set.estimatedDurationSeconds} seconds ·{" "}
                {(set.primaryTargetIds as string[]).length} primary objective(s)
              </p>
              <ul className="audit-history" aria-label="Practice-set review and audit history">
                {drafts.setReviews.filter((record) => record.practiceSetId === set.id).map((record) => <li key={record.id}>Review: {record.decision}, {record.createdAt.toISOString()}</li>)}
                {drafts.setAudits.filter((record) => record.practiceSetId === set.id).map((record) => <li key={record.id}>{record.action.replaceAll("_", " ")}, {record.createdAt.toISOString()}</li>)}
              </ul>
              <PracticeSetWorkflowControls practiceSetId={set.id} status={set.status} submitAction={submitPracticeSetForReviewAction} approveAction={approvePracticeSetAction} publishAction={publishPracticeSetAction} retireAction={retirePracticeSetAction} />
            </article>
          ))}
        </div>
        <div className="account-list">
          {drafts.questions.map((item) => (
            <article className="account-card" key={item.id}>
              <h3>Question: {item.engine}</h3>
              <p>Status: {item.status}</p>
              <p>{item.prompt}</p>
              {controls("question", item)}
            </article>
          ))}
          {drafts.media.map((item) => (
            <article className="account-card" key={item.id}>
              <h3>Media: {item.mediaType}</h3>
              <p>Status: {item.status}</p>
              {item.previewUrl && item.mediaType === "image" && (
                <Image
                  src={item.previewUrl}
                  alt="Staff media preview"
                  width={375}
                  height={250}
                />
              )}
              {item.previewUrl && item.mediaType === "audio" && (
                <audio controls src={item.previewUrl} />
              )}
              <p>{item.description}</p>
              {controls("media", item)}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
