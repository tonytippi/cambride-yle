import { requireRole } from "@/features/identity/ui/session";
import { getPublishedLibrary } from "@/features/content/application/content";
import { engineLabel, minutes, paperLabel } from "@/features/content/ui/labels";

export default async function PublishedContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireRole(["teacher", "academic_lead", "admin"]);
  const { q } = await searchParams;
  const library = await getPublishedLibrary(actor);
  const query = q?.trim().toLocaleLowerCase("en-GB") ?? "";
  const matches = (text: string) => !query || text.toLocaleLowerCase("en-GB").includes(query);
  const sets = library.sets.filter((set) => matches(`${set.title} ${set.items.map((item) => item.prompt).join(" ")}`));
  const questions = library.questions.filter((question) => matches(`${question.prompt} ${question.topic} ${question.objective}`));
  return (
    <>
      <h1>Published content</h1>
      <p>Practice sets and questions learners can use now. This view is read-only.</p>
      <form className="library-filters" method="get" role="search" aria-label="Search published content">
        <label>Search<input name="q" type="search" defaultValue={q} placeholder="Title, prompt, topic or objective" /></label>
        <button className="secondary">Search</button>
      </form>
      <section className="staff-section" aria-labelledby="published-sets">
        <h2 id="published-sets">Practice sets ({sets.length})</h2>
        {sets.length === 0 && <p>No published practice sets{query ? " match this search" : " yet"}.</p>}
        <div className="library-list">
          {sets.map((set) => (
            <article key={set.id} className="library-item status-published" aria-labelledby={`set-${set.id}`}>
              <h3 id={`set-${set.id}`}>{set.title}</h3>
              <p className="meta">{paperLabel(set.paper, set.part)} · {minutes(set.estimatedDurationSeconds)} · {set.items.length === 1 ? "1 question" : `${set.items.length} questions`}</p>
              <ol>{set.items.map((item) => <li key={item.position}>{item.prompt} <span className="field-hint">· {engineLabel(item.engine)}</span></li>)}</ol>
            </article>
          ))}
        </div>
      </section>
      <section className="staff-section" aria-labelledby="published-questions">
        <h2 id="published-questions">Questions ({questions.length})</h2>
        {questions.length === 0 && <p>No published questions{query ? " match this search" : " yet"}.</p>}
        <div className="library-list">
          {questions.map((question) => (
            <article key={question.id} className="library-item status-published" aria-labelledby={`question-${question.id}`}>
              <h3 id={`question-${question.id}`}>{question.prompt}</h3>
              <p className="meta">{paperLabel(question.paper, question.part)} · {engineLabel(question.engine)} · {question.topic} · {minutes(Number(question.estimatedDurationSeconds))}</p>
              <p className="meta">Objective: {question.objective} · Options: {question.options.join(" · ")}</p>
              {question.media.length > 0 && (
                <ul className="thumbs" aria-label="Pictures and sounds">
                  {question.media.map((media) => (
                    <li key={media.id}>
                      {media.hasFile && media.mediaType === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- private, uncached staff preview
                        <img src={`/api/content/media/${media.id}`} alt={media.description} width={96} height={96} />
                      ) : media.hasFile ? <audio controls preload="none" src={`/api/content/media/${media.id}`} aria-label={media.description} /> : <span className="media-icon">No file</span>}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
