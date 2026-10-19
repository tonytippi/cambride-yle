import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ listPublishedSetsForLearner: vi.fn(), listLearnerEvidenceFacts: vi.fn(), getTargetLabels: vi.fn(), recordRecommendation: vi.fn(), preparePublishedPractice: vi.fn(), startPublishedPractice: vi.fn(), getOpenPracticeAttempt: vi.fn(), getPracticePlayer: vi.fn(), savePracticeResponse: vi.fn(), recordPracticePlayback: vi.fn(), submitPracticeAttempt: vi.fn(), getSubmittedPracticeReview: vi.fn() }));
vi.mock("@/features/practice/infrastructure/repositories", () => dependencies);
import { getLearnerHome, getPracticePlayer, getSubmittedPracticeReview, preparePractice, recordPracticePlayback, savePracticeResponse, startPractice, submitPracticeAttempt } from "@/features/practice/application/practice";

const learner = { id: "018f0000-0000-7000-8000-000000000001", role: "learner" as const, email: "learner@example.test", displayName: "Learner" };
const fact = (practiceSetId: string, languageTargetId: string, outcome: "correct" | "incorrect" | "unanswered" | "needs_teacher_review", attemptId = `${practiceSetId}-latest`, submittedAt = new Date()) => ({ attemptId, learnerId: learner.id, learnerName: "Learner", practiceSetId, paper: "listening" as const, part: "1", languageTargetId, languageTarget: languageTargetId, automaticOutcome: outcome, effectiveOutcome: outcome, resolutionRevision: 0, submittedAt, dimensions: {} });
const facts = (practiceSetId: string, languageTargetId: string, outcomes: ("correct" | "incorrect" | "unanswered" | "needs_teacher_review")[], attemptId?: string, submittedAt?: Date) => outcomes.map((outcome) => fact(practiceSetId, languageTargetId, outcome, attemptId, submittedAt));
const row = (id: string, openLastSavedAt: Date | null = null, submittedAttemptId: string | null = null) => ({ id, title: `Set ${id}`, paper: "listening" as const, part: "1", estimatedDurationSeconds: 300, targetIds: ["animals"], topic: "Animals", taskType: "Picture choice", openLastSavedAt, submittedAttemptId });

describe("learner practice home", () => {
  beforeEach(() => { vi.clearAllMocks(); dependencies.listPublishedSetsForLearner.mockResolvedValue([]); dependencies.listLearnerEvidenceFacts.mockResolvedValue([]); dependencies.getTargetLabels.mockResolvedValue([]); });
  it("authorises learners before querying practice data", async () => {
    await expect(getLearnerHome({ ...learner, role: "teacher" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dependencies.listPublishedSetsForLearner).not.toHaveBeenCalled();
  });
  it("uses resume before review and excludes attempts not returned for the learner", async () => {
    const saved = new Date("2026-08-20T10:00:00Z");
    dependencies.listPublishedSetsForLearner.mockResolvedValue([row("one", saved, "submitted-one"), row("two", null, "submitted-two"), row("three")]);
    const home = await getLearnerHome(learner);
    expect(home.sets.map((set) => set.action)).toEqual(["Resume", "Review", "Start"]);
    expect(home.sets[0]?.lastSavedAt).toEqual(saved);
  });
  it("ranks sets by the per-target evidence rule from the latest attempt of each set and labels the practice area", async () => {
    dependencies.listPublishedSetsForLearner.mockResolvedValue([{ ...row("other"), targetIds: ["food"] }, { ...row("building"), targetIds: ["school"] }, row("needs")]);
    dependencies.listLearnerEvidenceFacts.mockResolvedValue([
      ...facts("needs", "animals", ["incorrect", "incorrect", "correct"]),
      ...facts("needs", "animals", ["correct", "correct", "correct"], "needs-older", new Date(0)),
      ...facts("building", "school", ["correct", "correct", "incorrect"]),
      ...facts("other", "food", ["correct", "correct", "correct"]),
    ]);
    dependencies.getTargetLabels.mockResolvedValue([{ id: "animals", guidance: "Animal words", canonicalId: "animals" }]);
    const home = await getLearnerHome(learner);
    expect(home.recommendation).toEqual({ version: "learner-home-v2", setIds: ["needs", "building", "other"], practiceArea: "Animal words · Listening Part 1" });
    expect(dependencies.recordRecommendation).toHaveBeenCalledWith(learner.id, "learner-home-v2", ["needs", "building", "other"]);
    expect(dependencies.listLearnerEvidenceFacts).toHaveBeenCalledWith(learner.id, expect.any(Date));
    expect(dependencies.getTargetLabels).toHaveBeenCalledWith(["animals"]);
  });
  it("counts outcomes, not practice areas, so one set with three assessable answers can produce a recommendation", async () => {
    dependencies.listPublishedSetsForLearner.mockResolvedValue([row("one")]);
    dependencies.listLearnerEvidenceFacts.mockResolvedValue(facts("one", "animals", ["incorrect", "unanswered", "correct", "needs_teacher_review"]));
    dependencies.getTargetLabels.mockResolvedValue([{ id: "animals", guidance: "A long staff-facing guidance note that explains exactly how to teach and assess animal vocabulary", canonicalId: "pet-animals" }]);
    await expect(getLearnerHome(learner)).resolves.toMatchObject({ recommendation: { setIds: ["one"], practiceArea: "Pet animals · Listening Part 1" } });
  });
  it("does not match a target practised in a different paper or part", async () => {
    dependencies.listPublishedSetsForLearner.mockResolvedValue([{ ...row("writing"), paper: "reading_writing", title: "A writing" }, { ...row("listening"), title: "B listening" }]);
    dependencies.listLearnerEvidenceFacts.mockResolvedValue(facts("listening", "animals", ["incorrect", "incorrect", "incorrect"]));
    await expect(getLearnerHome(learner)).resolves.toMatchObject({ recommendation: { setIds: ["listening", "writing"] } });
  });
  it("retains all filter choices while filtering only manual browsing, not recommendations or their audit", async () => {
    dependencies.listPublishedSetsForLearner.mockResolvedValue([row("animals"), { ...row("school"), targetIds: ["school"], topic: "School", taskType: "Note taking" }, { ...row("food"), targetIds: ["food"], topic: "Food", taskType: "Word bank" }]);
    dependencies.listLearnerEvidenceFacts.mockResolvedValue([...facts("animals", "animals", ["incorrect", "incorrect", "incorrect"]), ...facts("school", "school", ["correct", "correct", "incorrect"])]);
    const home = await getLearnerHome(learner, { topic: "School", taskType: "Note taking" });
    expect(home.sets.map((set) => set.id)).toEqual(["school"]);
    expect(home.filters).toEqual({ topic: "School", taskType: "Note taking", topics: ["Animals", "School", "Food"], taskTypes: ["Picture choice", "Note taking", "Word bank"] });
    expect(home.recommendation).toMatchObject({ setIds: ["animals", "school", "food"] });
    expect(dependencies.recordRecommendation).toHaveBeenCalledWith(learner.id, "learner-home-v2", ["animals", "school", "food"]);
  });
  it("rejects notice from the application boundary so it cannot influence learner-home data", async () => {
    await expect(getLearnerHome(learner, { notice: "Not a filter" } as never)).rejects.toBeInstanceOf(Error);
    expect(dependencies.listPublishedSetsForLearner).not.toHaveBeenCalled();
  });
  it("keeps browsing available and avoids an audit claim with fewer than three assessable outcomes or only secure areas", async () => {
    dependencies.listPublishedSetsForLearner.mockResolvedValue([row("one")]);
    dependencies.listLearnerEvidenceFacts.mockResolvedValue(facts("one", "animals", ["incorrect", "incorrect", "needs_teacher_review"]));
    await expect(getLearnerHome(learner)).resolves.toMatchObject({ sets: [expect.objectContaining({ id: "one" })], recommendation: undefined });
    expect(dependencies.recordRecommendation).not.toHaveBeenCalled();
  });
});

describe("practice preparation and start", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("authorises learners and rejects invalid preparation input before repository access", async () => {
    await expect(preparePractice({ ...learner, role: "teacher" }, { setId: learner.id })).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    await expect(preparePractice({ ...learner, role: "admin" }, { setId: learner.id })).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    await expect(preparePractice(learner, { setId: "not-a-uuid" })).resolves.toMatchObject({ error: { code: "INPUT_INVALID" } });
    expect(dependencies.preparePublishedPractice).not.toHaveBeenCalled();
  });
  it("returns immutable preparation data and rejects missing essential media", async () => {
    dependencies.preparePublishedPractice.mockResolvedValueOnce({ setId: learner.id, setVersionId: learner.id, title: "Animals", assets: [{ id: learner.id, type: "audio", url: "/api/practice/media?token=opaque", cacheKey: "media/id/hash" }] });
    await expect(preparePractice(learner, { setId: learner.id })).resolves.toMatchObject({ data: { title: "Animals" } });
    dependencies.preparePublishedPractice.mockResolvedValueOnce({ error: "ESSENTIAL_MEDIA_MISSING" });
    await expect(preparePractice(learner, { setId: learner.id })).resolves.toMatchObject({ error: { code: "ESSENTIAL_MEDIA_MISSING" } });
  });
  it("returns authoritative start and resume states without creating a client-side substitute", async () => {
    await expect(startPractice({ ...learner, role: "admin" }, { setId: learner.id })).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(dependencies.startPublishedPractice).not.toHaveBeenCalled();
    dependencies.startPublishedPractice.mockResolvedValueOnce({ attemptId: learner.id, setId: learner.id, setVersionId: learner.id, revision: 0, disposition: "started" });
    await expect(startPractice(learner, { setId: learner.id })).resolves.toMatchObject({ data: { disposition: "started" } });
    dependencies.startPublishedPractice.mockResolvedValueOnce({ attemptId: learner.id, setId: learner.id, setVersionId: learner.id, revision: 2, disposition: "resume" });
    await expect(startPractice(learner, { setId: learner.id })).resolves.toMatchObject({ data: { disposition: "resume", revision: 2 } });
  });
});

describe("practice player mutations", () => {
  const input = { setId: learner.id, attemptId: "018f0000-0000-7000-8000-000000000002", itemId: "018f0000-0000-7000-8000-000000000003", expectedRevision: 2 };
  beforeEach(() => { vi.clearAllMocks(); });
  it("returns learner-safe player data only after learner authorisation", async () => {
    dependencies.getPracticePlayer.mockResolvedValue({ attemptId: input.attemptId, setId: input.setId, setVersionId: input.setId, revision: 2, title: "Animals", items: [] });
    await expect(getPracticePlayer(learner, { setId: input.setId, attemptId: input.attemptId })).resolves.toMatchObject({ data: { revision: 2, items: [] } });
    await expect(getPracticePlayer({ ...learner, role: "teacher" }, input)).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });
  it("requires valid revisioned inputs and preserves authoritative conflicts", async () => {
    await expect(savePracticeResponse(learner, { ...input, value: { answer: "no" } })).resolves.toMatchObject({ error: { code: "INPUT_INVALID" } });
    dependencies.savePracticeResponse.mockResolvedValue({ error: "ATTEMPT_REVISION_CONFLICT" });
    await expect(savePracticeResponse(learner, { ...input, value: "cat" })).resolves.toMatchObject({ error: { code: "ATTEMPT_REVISION_CONFLICT" } });
    dependencies.recordPracticePlayback.mockResolvedValue({ error: "ATTEMPT_FINALISED" });
    await expect(recordPracticePlayback(learner, { ...input, mediaId: "018f0000-0000-7000-8000-000000000004" })).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
  });
});

describe("practice submission and review", () => {
  const input = { setId: learner.id, attemptId: "018f0000-0000-7000-8000-000000000002", expectedRevision: 3, idempotencyKey: "018f0000-0000-7000-8000-000000000005" };
  beforeEach(() => { vi.clearAllMocks(); });
  it("authorises and validates submission before server finalisation", async () => {
    await expect(submitPracticeAttempt({ ...learner, role: "teacher" }, input)).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    await expect(submitPracticeAttempt(learner, { ...input, idempotencyKey: "invalid" })).resolves.toMatchObject({ error: { code: "INPUT_INVALID" } });
    expect(dependencies.submitPracticeAttempt).not.toHaveBeenCalled();
  });
  it("returns the server-saved result for finalisation and idempotent retry", async () => {
    const saved = { attemptId: input.attemptId, setId: input.setId, submittedAt: new Date("2026-08-20T12:00:00Z"), revision: 4 };
    dependencies.submitPracticeAttempt.mockResolvedValue(saved);
    await expect(submitPracticeAttempt(learner, input)).resolves.toEqual({ data: saved });
    await expect(submitPracticeAttempt(learner, input)).resolves.toEqual({ data: saved });
    expect(dependencies.submitPracticeAttempt).toHaveBeenCalledWith(learner.id, input);
  });
  it("releases review data only through the submitted review contract", async () => {
    dependencies.getSubmittedPracticeReview.mockResolvedValue({ attemptId: input.attemptId, setId: input.setId, submittedAt: new Date(), revision: 4, title: "Animals", items: [{ id: "018f0000-0000-7000-8000-000000000003", position: 1, response: "cat", outcome: "correct", approvedAnswer: "cat", evidenceLabel: "secure" }] });
    await expect(getSubmittedPracticeReview(learner, { setId: input.setId, attemptId: input.attemptId })).resolves.toMatchObject({ data: { items: [expect.objectContaining({ approvedAnswer: "cat", outcome: "correct" })] } });
    dependencies.getSubmittedPracticeReview.mockResolvedValue({ error: "ATTEMPT_FINALISED" });
    await expect(getSubmittedPracticeReview(learner, { setId: input.setId, attemptId: input.attemptId })).resolves.toMatchObject({ error: { code: "ATTEMPT_FINALISED" } });
  });
});
