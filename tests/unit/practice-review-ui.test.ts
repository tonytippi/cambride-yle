import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubmittedPracticeReview } from "@/features/practice/ui/submitted-practice-review";
import type { SubmittedPracticeReview as Review } from "@/features/practice/domain/contracts";

const item = (position: number, outcome: Review["items"][number]["outcome"], response: string | null) => ({ id: `item-${position}`, position, engine: "picture_true_false" as const, prompt: `Prompt ${position}`, targets: [{ id: "pets", label: "pets" }], response, responseLabel: response ?? undefined, outcome, approvedAnswer: "True", approvedAnswerLabel: "True" });
const review: Review = { attemptId: "attempt", setId: "set", submittedAt: new Date("2026-10-19T10:00:00Z"), revision: 3, title: "My pets", paper: "reading_writing", part: "1",
  items: [item(1, "correct", "True"), item(2, "incorrect", "False"), item(3, "unanswered", null), item(4, "needs_teacher_review", "Maybe")],
  areas: [{ targetId: "pets", name: "Pet vocabulary · Reading and Writing Part 1", state: "needs practice" }, { targetId: "plural", name: "Plural nouns · Reading and Writing Part 1", state: "not assessed yet" }] };

describe("submitted practice review", () => {
  it("summarises the result per practice area before calm, referenced answer rows", () => {
    const markup = renderToStaticMarkup(createElement(SubmittedPracticeReview, { review }));
    expect(markup).toContain("You answered 3 of 4 questions.");
    expect(markup).toContain("<strong>Needs practice:</strong> Pet vocabulary · Reading and Writing Part 1.");
    expect(markup).toContain("This practice did not have enough answers about this yet. It is not a problem.");
    expect(markup).toContain("This is practice feedback, not an official exam result.");
    expect(markup).toContain('href="#answers">Check my answers</a>');
    expect(markup.indexOf("Check my answers")).toBeLessThan(markup.indexOf("Question 1"));
    for (const text of ["Picture question", "Prompt 2", "You got this one right.", "Look at the correct answer.", "You did not answer this one.", "Your teacher will check this answer."]) expect(markup).toContain(text);
    const visible = markup.replace(/<[^>]+>/g, " ");
    expect(visible).not.toMatch(/needs_teacher_review|\bincorrect\b|\bunanswered\b|\bpass\b|\bfail|\bscore/i);
    expect(visible.match(/Needs practice/g)).toHaveLength(1);
  });
});
