import { describe, expect, it } from "vitest";
import { questionDraftSchema } from "@/features/content/domain/contracts";

const input = {
  paper: "listening", part: 1, engine: "picture_true_false",
  primaryTargetId: "018f0000-0000-7000-8000-000000000002",
  supportingTargetIds: [], topicIds: ["018f0000-0000-7000-8000-000000000003"], guidanceId: "018f0000-0000-7000-8000-000000000004",
  estimatedDurationSeconds: 60, accessibilityMetadata: { altText: "A red ball." }, provenance: { source: "Original", rightsReference: "Owned" },
  answerPolicyVersionId: "018f0000-0000-7000-8000-000000000005", prompt: "A red ball.", options: ["true", "false"],
};

describe("content evidence dimensions", () => {
  it("normalises optional spelling, colour and position tags", () => {
    expect(questionDraftSchema.parse({ ...input, evidenceDimensions: { spelling: ["  ball  "], colours: [" red "], positions: [" under "] } }).evidenceDimensions).toEqual({ spelling: ["ball"], colours: ["red"], positions: ["under"] });
  });

  it("rejects unknown or marked-up evidence tags", () => {
    expect(questionDraftSchema.safeParse({ ...input, evidenceDimensions: { spelling: ["<b>ball</b>"], colours: [], positions: [] } }).success).toBe(false);
    expect(questionDraftSchema.safeParse({ ...input, evidenceDimensions: { spelling: [], colours: [], positions: [], topic: ["Animals"] } }).success).toBe(false);
  });
});
