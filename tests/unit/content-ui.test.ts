import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentWorkflowControls } from "@/features/content/ui/draft-forms";
import { ReadinessReport } from "@/features/content/ui/readiness-report";

const action = async () => ({});
const controls = (status: "draft" | "in_review") => renderToStaticMarkup(createElement(ContentWorkflowControls, { kind: "question", targetId: "018f0000-0000-7000-8000-000000000009", status, validateAction: action, submitAction: action, approveAction: action, rejectAction: action, exceptionAction: action, previewAction: action }));

describe("content workflow controls", () => {
  it("shows validation only while content is a draft", () => {
    expect(controls("draft")).toContain("Run validation");
    expect(controls("in_review")).not.toContain("Run validation");
    expect(controls("in_review")).toContain("Approve content");
  });
});

describe("readiness report", () => {
  it("renders all engine coverage gaps and concrete media/composition gaps", () => {
    const markup = renderToStaticMarkup(createElement(ReadinessReport, { targetLabels: new Map([["topic-1", "Animals"], ["target-1", "Cat"]]), readiness: { engines: ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"].map((engine) => ({ engine, covered: engine === "picture_true_false", gaps: engine === "picture_true_false" ? [] : ["NO_PUBLISHED_QUESTION"] })), coverage: [{ engine: "picture_true_false", paper: "reading_writing", part: "1", guidanceId: "guidance-1", topic: "Animals", taskType: "Picture true false", topicTargetIds: ["topic-1"], vocabularyGrammarTargets: ["target-1"], estimatedDurationSeconds: 120, mediaEligible: false, gaps: ["ASSOCIATED_MEDIA_NOT_PUBLISHED"] }] } }));
    for (const engine of ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"]) expect(markup).toContain(engine);
    expect(markup).toContain("ASSOCIATED_MEDIA_NOT_PUBLISHED");
    expect(markup).toContain("Animals");
  });
});
