import { describe, expect, it } from "vitest";
import { questionDraftSchema } from "@/features/content/domain/contracts";

const base = {
  paper: "reading_writing", part: 1, engine: "picture_true_false",
  primaryTargetId: "018f0000-0000-7000-8000-000000000002", supportingTargetIds: [],
  topicIds: ["018f0000-0000-7000-8000-000000000003"], guidanceId: "018f0000-0000-7000-8000-000000000004",
  estimatedDurationSeconds: 60, accessibilityMetadata: { altText: "A cat" },
  provenance: { source: "Original", rightsReference: "Owned" },
  answerPolicyVersionId: "018f0000-0000-7000-8000-000000000005", prompt: "A cat", options: ["true", "false"],
};

describe("post-submit hint contract", () => {
  it("accepts an absent hint or an English plain-text hint", () => {
    expect(questionDraftSchema.safeParse(base).success).toBe(true);
    expect(questionDraftSchema.parse({ ...base, postSubmitHint: { locale: "en-GB", message: "  Look   carefully. " } }).postSubmitHint).toEqual({ locale: "en-GB", message: "Look carefully." });
  });

  it("rejects a non-English locale or markup in a hint", () => {
    expect(questionDraftSchema.safeParse({ ...base, postSubmitHint: { locale: "vi-VN", message: "Look carefully." } }).success).toBe(false);
    expect(questionDraftSchema.safeParse({ ...base, postSubmitHint: { locale: "en-GB", message: "<b>Look</b>" } }).success).toBe(false);
  });
});
