import { describe, expect, it } from "vitest";
import { importTarget, mergeForPush, parseRecord, reaches, recordKey, serialiseRecord, type PolicyRecord, type PracticeSetRecord } from "@/features/content-library/domain/records";

const set: PracticeSetRecord = {
  schemaVersion: 1, kind: "practice_set", id: "018f0000-0000-7000-8000-000000000001", status: "approved", approvedBy: "lead@example.test", title: "Toys", paper: "reading_writing",
  part: "1", estimatedDurationSeconds: 300, primaryTargetIds: [], questionIds: ["018f0000-0000-7000-8000-000000000002"], createdBy: "lead@example.test", createdAt: "2026-10-21T00:00:00.000Z",
};
const version = (number: number, id: string) => ({ id, version: number, inputKind: "boolean", canonicalAnswer: true, acceptedAnswers: [], normalisation: {}, maxWords: 1, teacherReviewIfUncertain: false, createdBy: null, vectors: [] });
const policy: PolicyRecord = {
  schemaVersion: 1, kind: "policy", id: "018f0000-0000-7000-8000-000000000003", canonicalId: "ball", targetId: "018f0000-0000-7000-8000-000000000004", guidanceId: "018f0000-0000-7000-8000-000000000005",
  paper: "reading_writing", part: 1, engine: "picture_true_false", versions: [version(1, "018f0000-0000-7000-8000-000000000006")],
};

describe("content library records", () => {
  it("round-trips a record through its JSON file and keys it by kind and ID", () => {
    expect(parseRecord(serialiseRecord(set))).toEqual(set);
    expect(recordKey(set)).toBe(`content-library/v1/practice-sets/${set.id}.json`);
    expect(parseRecord("{not json")).toBeUndefined();
    expect(parseRecord(JSON.stringify({ ...set, schemaVersion: 2 }))).toBeUndefined();
  });
  it("never moves a version backwards when another database pushes an earlier status", () => {
    const published = { ...set, status: "published" as const, approvedBy: "admin@example.test" };
    expect(mergeForPush(published, set)).toEqual(published);
    expect(mergeForPush(set, published)).toEqual(published);
    expect(mergeForPush(undefined, set)).toEqual(set);
  });
  it("keeps every answer-policy version pushed by any database", () => {
    const merged = mergeForPush(policy, { ...policy, versions: [version(2, "018f0000-0000-7000-8000-000000000007")] });
    expect(merged.kind === "policy" && merged.versions.map((entry) => entry.version)).toEqual([1, 2]);
  });
  it("imports anything not yet approved as a draft", () => {
    expect(importTarget("in_review")).toBe("draft");
    expect(reaches("in_review", "approved")).toBe(false);
    expect(reaches("retired", "published")).toBe(true);
    expect(reaches("approved", "published")).toBe(false);
  });
});
