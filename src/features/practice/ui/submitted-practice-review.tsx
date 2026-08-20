import type { SubmittedPracticeReview as Review } from "../domain/contracts";

const labels = { secure: "Secure", building: "Building", needs_practice: "Needs practice", not_assessed_yet: "Not assessed yet" } as const;
export function SubmittedPracticeReview({ review }: { review: Review }) {
  return <main className="shell"><section className="submitted-review"><p className="eyebrow">Submitted {review.submittedAt.toLocaleString("en-GB")}</p><h1>{review.title}</h1><p>Your submitted answers and review are below.</p>{review.items.map((item) => <article key={item.id} className="review-item"><h2>Question {item.position}</h2><p><strong>Your answer:</strong> {item.response === null ? "No answer" : item.responseLabel}</p><p><strong>Approved answer:</strong> {item.approvedAnswerLabel}</p>{item.explanation && <p>{item.explanation}</p>}<p><strong>Review:</strong> {item.outcome.replaceAll("_", " ")}</p><p className="evidence-label">{labels[item.evidenceLabel]}</p></article>)}<a className="practice-action" href="/learner">Back to your practice</a></section></main>;
}
