import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentWorkflowControls } from "@/features/content/ui/draft-forms";

const action = async () => ({});
const controls = (status: "draft" | "in_review") => renderToStaticMarkup(createElement(ContentWorkflowControls, { kind: "question", targetId: "018f0000-0000-7000-8000-000000000009", status, validateAction: action, submitAction: action, approveAction: action, rejectAction: action, exceptionAction: action, previewAction: action }));

describe("content workflow controls", () => {
  it("shows validation only while content is a draft", () => {
    expect(controls("draft")).toContain("Run validation");
    expect(controls("in_review")).not.toContain("Run validation");
    expect(controls("in_review")).toContain("Approve content");
  });
});
