import type { SubmittedPracticeReview as Review } from "../domain/contracts";

const references = { picture_true_false: "Picture question", picture_yes_no: "Picture question", audio_picture_choice: "Listening and pictures", audio_note_taking: "Listening", word_bank_cloze: "Word bank" } as const;
const outcomes = { correct: "You got this one right.", incorrect: "Look at the correct answer.", unanswered: "You did not answer this one.", needs_teacher_review: "Your teacher will check this answer." } as const;
const states = { secure: "Secure", building: "Building", "needs practice": "Needs practice", "not assessed yet": "Not assessed yet" } as const;
const stateClass = (state: keyof typeof states) => state.replaceAll(" ", "-");

/* Result summary first, then answer review; evidence wording follows EXPERIENCE.md and never reads as an official result. */
export function SubmittedPracticeReview({ review }: { review: Review }) {
  const answered = review.items.filter((item) => item.response !== null).length;
  return <main className="shell"><section className="submitted-review">
    <p className="eyebrow">Practice complete</p>
    <h1>{review.title}</h1>
    <section className="result-summary" aria-labelledby="result-summary-heading">
      <h2 id="result-summary-heading">You finished this practice</h2>
      <p>You answered {answered} of {review.items.length} questions.</p>
      <ul className="result-areas">{review.areas.map((area) => <li key={area.targetId} className={`result-area ${stateClass(area.state)}`}>
        <strong>{states[area.state]}:</strong> {area.name}.
        {area.state === "not assessed yet" && <span className="result-area-note"> This practice did not have enough answers about this yet. It is not a problem.</span>}
      </li>)}</ul>
      <p className="result-note">This is practice feedback, not an official exam result.</p>
      <a className="practice-action" href="#answers">Check my answers</a>
    </section>
    <section id="answers" aria-labelledby="answers-heading" tabIndex={-1}>
      <h2 id="answers-heading">Your answers</h2>
      {review.items.map((item) => <article key={item.id} className={`review-item ${item.outcome}`}>
        <h3>Question {item.position}</h3>
        <p className="eyebrow">{references[item.engine]}</p>
        <p className="review-prompt">{item.prompt}</p>
        <p><strong>Your answer:</strong> {item.response === null ? "No answer" : item.responseLabel}</p>
        <p><strong>Correct answer:</strong> {item.approvedAnswerLabel}</p>
        <p className="review-outcome">{outcomes[item.outcome]}</p>
        {item.explanation && <p>{item.explanation}</p>}
      </article>)}
    </section>
    <a className="practice-action" href="/learner">Back to your practice</a>
  </section></main>;
}
