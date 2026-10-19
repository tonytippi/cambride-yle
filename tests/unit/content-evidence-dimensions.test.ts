import { describe, expect, it } from "vitest";
import { questionDraftSchema } from "@/features/content/domain/contracts";
import { snapshotItemTags, snapshotMediaHash } from "@/features/content/domain/snapshot";

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

describe("published snapshot tags", () => {
  const targets = [
    { id: "primary", canonicalId: "animals-cat", category: "vocabulary" },
    { id: "support", canonicalId: "present-simple", category: "grammar" },
    { id: "other", canonicalId: "listen-for-names", category: "language_target" },
  ];
  const guidance = [{ id: "guide", topic: "Animals", approvedNames: ["Tom", 3], approvedNumbers: [7, "eight"] }];

  it("derives vocabulary, grammar, guidance and authored dimensions from controlled data", () => {
    expect(snapshotItemTags({ primaryTargetId: "primary", supportingTargetIds: ["support", "other", 4], topicIds: ["topic"], guidanceId: "guide", evidenceDimensions: { spelling: ["cat"], colours: "red" } }, targets, guidance)).toEqual({
      primaryTargetId: "primary",
      supportingTargetIds: ["support", "other", 4],
      topicIds: ["topic"],
      guidanceId: "guide",
      dimensions: { vocabulary: ["animals-cat"], grammar: ["present-simple"], names: ["Tom"], numbers: ["7"], spelling: ["cat"], colours: [], positions: [], topic: ["Animals"] },
    });
  });

  it("leaves guidance dimensions empty when the guidance is missing", () => {
    expect(snapshotItemTags({ primaryTargetId: "primary", supportingTargetIds: null, topicIds: [], guidanceId: "missing", evidenceDimensions: null }, targets, guidance).dimensions).toEqual({ vocabulary: ["animals-cat"], grammar: [], names: [], numbers: [], spelling: [], colours: [], positions: [], topic: [] });
  });

  it("hashes media identity, preview, description and provenance stably", () => {
    const media = { id: "m1", previewUrl: "https://example.test/cat.png", description: "A cat", provenance: { source: "Owned" } };
    expect(snapshotMediaHash(media)).toBe(snapshotMediaHash({ ...media }));
    expect(snapshotMediaHash({ ...media, description: "A dog" })).not.toBe(snapshotMediaHash(media));
    expect(snapshotMediaHash(media)).toMatch(/^[0-9a-f]{64}$/);
  });
});
