import { createHash } from "node:crypto";

/* Pure derivation of the immutable published snapshot; the repository only reads the inputs and writes the result. */
type SnapshotQuestion = {
  primaryTargetId: string;
  supportingTargetIds: unknown;
  topicIds: unknown;
  guidanceId: string;
  evidenceDimensions: unknown;
};
type SnapshotTarget = { id: string; canonicalId: string; category: string };
type SnapshotGuidance = { id: string; topic: string; approvedNames: unknown; approvedNumbers: unknown };

const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const evidenceDimensions = (value: unknown) => {
  const dimensions = value as { spelling?: unknown; colours?: unknown; positions?: unknown } | undefined;
  return { spelling: strings(dimensions?.spelling), colours: strings(dimensions?.colours), positions: strings(dimensions?.positions) };
};

export const supportingTargetIdsFor = (question: Pick<SnapshotQuestion, "supportingTargetIds">) => strings(question.supportingTargetIds);

export function snapshotItemTags(question: SnapshotQuestion, targets: SnapshotTarget[], guidance: SnapshotGuidance[]) {
  const targetIds = [question.primaryTargetId, ...supportingTargetIdsFor(question)];
  const canonicalIdsIn = (category: "vocabulary" | "grammar") => targetIds.flatMap((id) => {
    const target = targets.find((entry) => entry.id === id);
    return target?.category === category ? [target.canonicalId] : [];
  });
  const selected = guidance.find((entry) => entry.id === question.guidanceId);
  return {
    primaryTargetId: question.primaryTargetId,
    supportingTargetIds: question.supportingTargetIds,
    topicIds: question.topicIds,
    guidanceId: question.guidanceId,
    dimensions: {
      vocabulary: canonicalIdsIn("vocabulary"),
      grammar: canonicalIdsIn("grammar"),
      names: strings(selected?.approvedNames),
      numbers: Array.isArray(selected?.approvedNumbers) ? (selected.approvedNumbers as unknown[]).filter((value): value is number => typeof value === "number").map(String) : [],
      ...evidenceDimensions(question.evidenceDimensions),
      topic: [selected?.topic ?? ""].filter(Boolean),
    },
  };
}

export const snapshotMediaHash = (media: { id: string; previewUrl: unknown; description: unknown; provenance: unknown }) =>
  createHash("sha256")
    .update(JSON.stringify({ id: media.id, previewUrl: media.previewUrl, description: media.description, provenance: media.provenance }))
    .digest("hex");
