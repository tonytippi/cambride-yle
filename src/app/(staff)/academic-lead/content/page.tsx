import Image from "next/image";
import Link from "next/link";
import { ContentWorkflowControls } from "@/features/content/ui/draft-forms";
import { engineLabel, minutes, nextStepLabels, paperLabel, statusLabel, statusLabels } from "@/features/content/ui/labels";
import { acceptExceptionAction, approveContentAction, phonePreviewAction, publishContentAction, rejectContentAction, retireContentAction, submitForReviewAction, validateContentAction } from "../actions";
import { loadWorkspace } from "../workspace";

type Finding = { field: string; code: string; message: string };
type Status = "draft" | "in_review" | "approved" | "published" | "retired";

export default async function ContentLibrary({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string; q?: string }> }) {
  const filters = await searchParams;
  const { drafts, targetName, guidanceOf } = await loadWorkspace();
  const query = filters.q?.trim().toLocaleLowerCase("en-GB") ?? "";
  const items = [
    ...drafts.questions.map((item) => ({ kind: "question" as const, item, text: item.prompt, mediaType: undefined })),
    ...drafts.media.map((item) => ({ kind: "media" as const, item, text: item.description, mediaType: item.mediaType })),
  ]
    .filter((entry) => !filters.kind || entry.kind === filters.kind)
    .filter((entry) => !filters.status || entry.item.status === filters.status)
    .filter((entry) => !query || `${entry.text} ${entry.item.id}`.toLocaleLowerCase("en-GB").includes(query))
    .sort((left, right) => right.item.createdAt.getTime() - left.item.createdAt.getTime());
  const mediaById = new Map(drafts.media.map((item) => [item.id, item]));
  const latestFindings = (kind: string, id: string) => drafts.validations.find((record) => record.kind === kind && record.targetId === id)?.findings as Finding[] | undefined;
  return (
    <>
      <div className="page-heading">
        <h1>Content library</h1>
        <p><Link className="practice-action" href="/academic-lead/content/new">Create content</Link></p>
      </div>
      <form className="library-filters" method="get" role="search" aria-label="Filter content">
        <label>Type<select name="kind" defaultValue={filters.kind ?? ""}><option value="">Questions and media</option><option value="question">Questions</option><option value="media">Pictures and sounds</option></select></label>
        <label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">Any status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Search<input name="q" type="search" defaultValue={filters.q} placeholder="Prompt, description or ID" /></label>
        <button className="secondary">Apply filters</button>
        {(filters.kind || filters.status || filters.q) && <Link href="/academic-lead/content">Clear filters</Link>}
      </form>
      <p role="status">{items.length === 1 ? "1 item" : `${items.length} items`}</p>
      {items.length === 0 && <p className="notice">Nothing matches these filters. <Link href="/academic-lead/content/new">Create content</Link> or clear the filters.</p>}
      <div className="library-list">
        {items.map(({ kind, item, text, mediaType }) => {
          const task = guidanceOf(item.guidanceId);
          const findings = item.status === "draft" ? latestFindings(kind, item.id) : undefined;
          const associated = kind === "question" ? drafts.associations.filter((entry) => entry.questionVersionId === item.id).map((entry) => mediaById.get(entry.mediaVersionId)).filter((entry) => entry !== undefined) : [];
          const generation = drafts.generations.find((record) => record.targetId === item.id);
          const media = kind === "media" ? drafts.media.find((entry) => entry.id === item.id)! : undefined;
          return (
            <article key={item.id} className={`library-item status-${item.status}`} aria-labelledby={`item-${item.id}`}>
              <header>
                <p className="badges">
                  <span className="badge">{kind === "question" ? "Question" : mediaType === "audio" ? "Sound" : "Picture"}</span>
                  <span className={`badge status ${item.status}`}>{statusLabel(item.status)}</span>
                  {item.origin === "generated" && <span className="badge">AI draft</span>}
                  {item.sourceVersionId && <span className="badge">Revision</span>}
                </p>
                <h2 id={`item-${item.id}`}>{text}</h2>
                <p className="meta">{paperLabel(item.paper, item.part)} · {engineLabel(item.engine)}{task ? ` · ${task.topic}` : ""} · {minutes(Number(item.estimatedDurationSeconds))}</p>
                <p className="meta">Objective: {targetName(item.primaryTargetId)}{(item.topicIds as string[]).length ? ` · Topic: ${(item.topicIds as string[]).map(targetName).join(", ")}` : ""}</p>
              </header>
              {kind === "question" && (
                <>
                  <p className="meta">Options: {(item as { options: string[] }).options.join(" · ")}</p>
                  {associated.length > 0 && <ul className="thumbs" aria-label="Associated media">{associated.map((entry) => <li key={entry.id}>{entry.objectKey && entry.mediaType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, uncached staff preview
                    <img src={`/api/content/media/${entry.id}`} alt={entry.description} width={72} height={72} />
                  ) : <span className="media-icon">{entry.mediaType === "audio" ? "♪ Sound" : "Picture"}</span>}<span className="field-hint">{statusLabel(entry.status)}</span></li>)}</ul>}
                </>
              )}
              {media && (
                <div className="media-preview">
                  {media.objectKey && media.mediaType === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element -- private, uncached staff preview
                    <img className="staff-media-preview" src={`/api/content/media/${media.id}`} alt={(media.accessibilityMetadata as { altText?: string }).altText ?? media.description} width={375} loading="lazy" />
                  )}
                  {media.objectKey && media.mediaType === "audio" && <audio controls preload="none" src={`/api/content/media/${media.id}`} />}
                  {!media.objectKey && <p className="field-hint">No file uploaded yet. Learners cannot use this media until a file is added in a revision.</p>}
                  {!media.objectKey && media.previewUrl && media.mediaType === "image" && <Image src={media.previewUrl} alt="Staff media preview" width={375} height={250} />}
                </div>
              )}
              <p className="next-step"><strong>Next step:</strong> {nextStepLabels[item.status]}</p>
              {findings && findings.length > 0 && (
                <div className="findings" role="note">
                  <p><strong>Latest validation found {findings.length === 1 ? "1 issue" : `${findings.length} issues`}:</strong></p>
                  <ul>{findings.map((finding) => <li key={`${finding.field}-${finding.code}`}>{finding.message}</li>)}</ul>
                  <p className="field-hint">Fix them in a revision, or record an exception where allowed.</p>
                </div>
              )}
              {findings && findings.length === 0 && <p className="field-hint">Latest validation passed.</p>}
              <ContentWorkflowControls kind={kind} mediaType={mediaType === "image" || mediaType === "audio" ? mediaType : undefined} targetId={item.id} status={item.status as Status} validateAction={validateContentAction} submitAction={submitForReviewAction} approveAction={approveContentAction} publishAction={publishContentAction} retireAction={retireContentAction} rejectAction={rejectContentAction} exceptionAction={acceptExceptionAction} previewAction={phonePreviewAction} />
              {item.status !== "retired" && <p><Link href={`/academic-lead/content/new?type=${kind}&source=${item.id}`}>Edit as a new revision</Link></p>}
              <details className="history">
                <summary>History and details</summary>
                <p className="field-hint">ID: {item.id}{item.sourceVersionId ? ` · revises ${item.sourceVersionId}` : ""} · created {item.createdAt.toLocaleString("en-GB")}</p>
                {generation && <p className="field-hint">AI {generation.gatewayKind} gateway · {generation.model} · output hash {generation.outputHash.slice(0, 12)}</p>}
                <ul className="audit-history" aria-label="Validation and review history">
                  {drafts.validations.filter((record) => record.kind === kind && record.targetId === item.id).map((record) => <li key={record.id}>Validation, {record.createdAt.toLocaleString("en-GB")}: {(record.findings as Finding[]).length ? (record.findings as Finding[]).map((finding) => finding.message).join(" ") : "passed"}</li>)}
                  {drafts.reviews.filter((record) => record.kind === kind && record.targetId === item.id).map((record) => <li key={record.id}>Review: {record.decision}{record.reason ? ` — ${record.reason}` : ""}, {record.createdAt.toLocaleString("en-GB")}</li>)}
                  {kind === "media" && drafts.previews.filter((record) => record.targetId === item.id).map((record) => <li key={record.id}>Phone preview at {record.viewportWidth}px confirmed, {record.createdAt.toLocaleString("en-GB")}</li>)}
                </ul>
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}
