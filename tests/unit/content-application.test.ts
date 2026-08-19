import { beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({
  transaction: vi.fn(),
  createQuestion: vi.fn(),
  createMedia: vi.fn(),
  getQuestion: vi.fn(),
  getMedia: vi.fn(),
  getContent: vi.fn(),
  getQuestions: vi.fn(),
  getMediaVersions: vi.fn(),
  lockQuestions: vi.fn(),
  lockMediaVersions: vi.fn(),
  createPublishedPracticeSet: vi.fn(),
  getPracticeSet: vi.fn(),
  retirePracticeSet: vi.fn(),
  getControlledReferences: vi.fn(),
  recordGeneration: vi.fn(),
  recordAudit: vi.fn(),
  recordPracticeSetAudit: vi.fn(),
  recordValidation: vi.fn(),
  latestValidation: vi.fn(),
  hasExceptionForValidation: vi.fn(),
  hasRejection: vi.fn(),
  updateStatus: vi.fn(),
  recordReview: vi.fn(),
  recordPhonePreview: vi.fn(),
  hasPhonePreview: vi.fn(),
  generate: vi.fn(),
}));
const config = vi.hoisted(() => ({ AI_DRAFT_PROVIDER_GATE_CLOSED: false }));
vi.mock("@/infrastructure/database/client", () => ({
  database: { transaction: dependencies.transaction },
}));
vi.mock("@/features/content/infrastructure/repositories", () => dependencies);
vi.mock("@/features/content/infrastructure/gateways", () => ({
  GatewayError: class GatewayError extends Error {
    constructor(code: string, message: string) {
      super(message);
      Object.assign(this, { code });
    }
  },
  generate: dependencies.generate,
}));
vi.mock("@/shared/config/server", () => ({ serverConfig: config }));
import {
  acceptException,
  approveContent,
  createManualQuestion,
  publishContent,
  publishPracticeSet,
  recordPhonePreview,
  rejectContent,
  requestAiDraft,
  reviseQuestion,
  submitForReview,
  validateContent,
} from "@/features/content/application/content";
const lead = {
  id: "018f0000-0000-7000-8000-000000000001",
  email: "lead@example.test",
  displayName: "Lead",
  role: "academic_lead" as const,
};
const teacher = { ...lead, role: "teacher" as const };
const input = {
  paper: "reading_writing" as const,
  part: 1,
  engine: "picture_true_false" as const,
  primaryTargetId: "018f0000-0000-7000-8000-000000000002",
  supportingTargetIds: [],
  topicIds: ["018f0000-0000-7000-8000-000000000003"],
  guidanceId: "018f0000-0000-7000-8000-000000000004",
  answerPolicyVersionId: "018f0000-0000-7000-8000-000000000005",
  prompt: "This is a cat.",
  options: ["true", "false"],
  estimatedDurationSeconds: 60,
  accessibilityMetadata: { altText: "A cat" },
  provenance: {
    source: "Original staff writing",
    rightsReference: "Centre-owned",
  },
};
describe("content draft use cases", () => {
  /* eslint-disable no-unused-vars */
  beforeEach(() => {
    vi.clearAllMocks();
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = false;
    dependencies.transaction.mockImplementation(
      async (boundary: (...args: [object]) => unknown) =>
        boundary({ transaction: "boundary" }),
    );
    dependencies.getControlledReferences.mockResolvedValue({
      targets: [
        { id: input.primaryTargetId, isApproved: true },
        { id: input.topicIds[0], isApproved: true },
      ],
      guidance: { paper: input.paper, part: input.part, engine: input.engine },
      policy: {
        policy: {
          targetId: input.primaryTargetId,
          guidanceId: input.guidanceId,
          paper: input.paper,
          part: input.part,
          engine: input.engine,
        },
      },
    });
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "draft",
      part: "1",
      estimatedDurationSeconds: "60",
      options: input.options,
      answerPolicyVersionId: input.answerPolicyVersionId,
    });
    dependencies.lockQuestions.mockImplementation((ids: string[]) => dependencies.getQuestions(ids));
    dependencies.lockMediaVersions.mockImplementation((ids: string[]) => dependencies.getMediaVersions(ids));
    dependencies.recordValidation.mockResolvedValue(
      "018f0000-0000-7000-8000-000000000010",
    );
    dependencies.latestValidation.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000010",
      findings: [],
    });
    dependencies.hasExceptionForValidation.mockResolvedValue(false);
    dependencies.hasRejection.mockResolvedValue(false);
    dependencies.hasPhonePreview.mockResolvedValue(false);
  });
  /* eslint-enable no-unused-vars */
  it("stores an authorised manual draft in a transaction", async () => {
    await createManualQuestion(lead, input);
    expect(dependencies.createQuestion).toHaveBeenCalledWith(
      input,
      lead.id,
      "manual",
      { transaction: "boundary" },
    );
  });
  it("denies a teacher before any content or audit mutation", async () => {
    await expect(createManualQuestion(teacher, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dependencies.transaction).not.toHaveBeenCalled();
  });
  it("rejects an audio draft for an image request before any audit or gateway mutation", async () => {
    await expect(
      requestAiDraft(lead, {
        kind: "image",
        staffPrompt: "Create an image",
        permittedReferences: [],
        draft: { ...input, mediaType: "audio", description: "Cat audio" },
      } as never),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(dependencies.transaction).not.toHaveBeenCalled();
    expect(dependencies.generate).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).not.toHaveBeenCalled();
  });
  it("blocks an open AI provider gate without gateway or duplicate generic audit", async () => {
    await expect(
      requestAiDraft(lead, {
        kind: "text",
        staffPrompt: "Create a simple draft",
        permittedReferences: [],
        draft: input,
      }),
    ).rejects.toMatchObject({ code: "AI_DRAFT_PROVIDER_GATE_OPEN" });
    expect(dependencies.generate).not.toHaveBeenCalled();
    expect(dependencies.createQuestion).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).toHaveBeenCalledTimes(1);
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "AI_DRAFT_REQUEST_BLOCKED_GATE_OPEN",
      "question",
      input.primaryTargetId,
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("audits preflight failures before sending an AI payload", async () => {
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = true;
    dependencies.getControlledReferences.mockResolvedValue({
      targets: [],
      guidance: undefined,
      policy: undefined,
    });
    await expect(
      requestAiDraft(lead, {
        kind: "text",
        staffPrompt: "Create a simple draft",
        permittedReferences: [],
        draft: input,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(dependencies.generate).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "AI_DRAFT_REQUEST_FAILED",
      "question",
      input.primaryTargetId,
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("audits missing source drafts without sending an AI payload", async () => {
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = true;
    dependencies.getQuestion.mockResolvedValue(undefined);
    await expect(
      requestAiDraft(
        lead,
        {
          kind: "text",
          staffPrompt: "Create a simple draft",
          permittedReferences: [],
          draft: input,
        },
        "018f0000-0000-7000-8000-000000000007",
      ),
    ).rejects.toMatchObject({ code: "CONTENT_DRAFT_NOT_FOUND" });
    expect(dependencies.generate).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "AI_DRAFT_REQUEST_FAILED",
      "question",
      input.primaryTargetId,
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("audits a provider failure independently without generated persistence", async () => {
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = true;
    dependencies.generate.mockRejectedValue(new Error("Provider unavailable"));
    await expect(
      requestAiDraft(lead, {
        kind: "text",
        staffPrompt: "Create a simple draft",
        permittedReferences: [],
        draft: input,
      }),
    ).rejects.toThrow("Provider unavailable");
    expect(dependencies.createQuestion).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).toHaveBeenCalledTimes(1);
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "AI_DRAFT_REQUEST_FAILED",
      "question",
      input.primaryTargetId,
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("audits image provider failures as media", async () => {
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = true;
    dependencies.generate.mockRejectedValue(new Error("Provider unavailable"));
    const imageDraft = {
      paper: input.paper,
      part: input.part,
      engine: input.engine,
      primaryTargetId: input.primaryTargetId,
      supportingTargetIds: input.supportingTargetIds,
      topicIds: input.topicIds,
      guidanceId: input.guidanceId,
      estimatedDurationSeconds: input.estimatedDurationSeconds,
      accessibilityMetadata: input.accessibilityMetadata,
      provenance: input.provenance,
    };
    await expect(
      requestAiDraft(lead, {
        kind: "image",
        staffPrompt: "Create an image",
        permittedReferences: [],
        draft: { ...imageDraft, mediaType: "image", description: "Cat image" },
      }),
    ).rejects.toThrow("Provider unavailable");
    expect(dependencies.createMedia).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).toHaveBeenCalledTimes(1);
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "AI_DRAFT_REQUEST_FAILED",
      "media",
      input.primaryTargetId,
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("audits generated output validation failures without generated persistence", async () => {
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = true;
    dependencies.generate.mockResolvedValue({
      endpoint: "https://ai.example.test",
      model: "text-model",
      output: { prompt: "", options: [] },
    });
    await expect(
      requestAiDraft(lead, {
        kind: "text",
        staffPrompt: "Create a simple draft",
        permittedReferences: [],
        draft: input,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(dependencies.createQuestion).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "AI_DRAFT_REQUEST_FAILED",
      "question",
      input.primaryTargetId,
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("audits final persistence failures and retains the original error", async () => {
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = true;
    dependencies.generate.mockResolvedValue({
      endpoint: "https://ai.example.test",
      model: "text-model",
      output: { prompt: "Generated cat prompt", options: ["true", "false"] },
    });
    dependencies.createQuestion.mockRejectedValue(
      new Error("Database unavailable"),
    );
    await expect(
      requestAiDraft(lead, {
        kind: "text",
        staffPrompt: "Create a simple draft",
        permittedReferences: [],
        draft: input,
      }),
    ).rejects.toThrow("Database unavailable");
    expect(dependencies.recordGeneration).not.toHaveBeenCalled();
    expect(dependencies.recordAudit).toHaveBeenCalledTimes(1);
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "AI_DRAFT_REQUEST_FAILED",
      "question",
      input.primaryTargetId,
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("incorporates gateway output and records provenance with a SHA-256 hash", async () => {
    config.AI_DRAFT_PROVIDER_GATE_CLOSED = true;
    dependencies.generate.mockResolvedValue({
      endpoint: "https://ai.example.test",
      model: "text-model",
      output: { prompt: "Generated cat prompt", options: ["true", "false"] },
    });
    dependencies.createQuestion.mockResolvedValue(
      "018f0000-0000-7000-8000-000000000006",
    );
    await requestAiDraft(lead, {
      kind: "text",
      staffPrompt: "Create a simple draft",
      permittedReferences: [{ id: "ref-1", description: "Original reference" }],
      draft: input,
    });
    expect(dependencies.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Generated cat prompt",
        options: ["true", "false"],
        provenance: expect.objectContaining({
          gatewayKind: "text",
          model: "text-model",
        }),
      }),
      lead.id,
      "generated",
      { transaction: "boundary" },
      undefined,
    );
    expect(dependencies.recordGeneration).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      "text",
      "https://ai.example.test",
      "text-model",
      { staffPrompt: "Create a simple draft" },
      [{ id: "ref-1", description: "Original reference" }],
      expect.stringMatching(/^[a-f0-9]{64}$/),
      { transaction: "boundary" },
    );
  });
  it("returns named controlled-reference findings without persisting a partial draft", async () => {
    dependencies.getControlledReferences.mockResolvedValue({
      targets: [],
      guidance: undefined,
      policy: undefined,
    });
    await expect(createManualQuestion(lead, input)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "TARGET_NOT_CONTROLLED" }),
        expect.objectContaining({ code: "GUIDANCE_NOT_FOUND" }),
      ]),
    });
    expect(dependencies.createQuestion).not.toHaveBeenCalled();
  });
  it("creates a new manual version instead of replacing a source draft", async () => {
    dependencies.getQuestion.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000007",
    });
    await reviseQuestion(lead, "018f0000-0000-7000-8000-000000000007", input);
    expect(dependencies.createQuestion).toHaveBeenCalledWith(
      input,
      lead.id,
      "manual",
      { transaction: "boundary" },
      "018f0000-0000-7000-8000-000000000007",
    );
  });
  it("records immutable named validation findings for an editable version", async () => {
    await validateContent(lead, {
      kind: "question",
      targetId: "018f0000-0000-7000-8000-000000000009",
    });
    expect(dependencies.recordValidation).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      lead.id,
      [],
      { transaction: "boundary" },
    );
  });
  it("rejects validation for content in review without recording new evidence", async () => {
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "in_review",
      part: "1",
      estimatedDurationSeconds: "60",
      options: input.options,
      answerPolicyVersionId: input.answerPolicyVersionId,
    });
    await expect(
      validateContent(lead, {
        kind: "question",
        targetId: "018f0000-0000-7000-8000-000000000009",
      }),
    ).rejects.toMatchObject({ code: "CONTENT_TRANSITION_CONFLICT" });
    expect(dependencies.recordValidation).not.toHaveBeenCalled();
  });
  it("records named plain-text and answer-leakage findings for immutable legacy drafts", async () => {
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "draft",
      part: "1",
      estimatedDurationSeconds: "60",
      prompt: "<b>Cat</b>",
      options: ["  true  ", "<i>false</i>"],
      accessibilityMetadata: { altText: "The answer is true." },
      provenance: { source: "Original", rightsReference: "<i>Owned</i>" },
    });
    await validateContent(lead, {
      kind: "question",
      targetId: "018f0000-0000-7000-8000-000000000009",
    });
    expect(dependencies.recordValidation).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      lead.id,
      expect.arrayContaining([
        expect.objectContaining({ field: "prompt", code: "STAFF_TEXT_MARKUP" }),
        expect.objectContaining({
          field: "options.0",
          code: "STAFF_TEXT_WHITESPACE_NOT_NORMALISED",
        }),
        expect.objectContaining({
          field: "options.1",
          code: "STAFF_TEXT_MARKUP",
        }),
        expect.objectContaining({
          field: "accessibilityMetadata.altText",
          code: "ACCESSIBILITY_ANSWER_LEAKAGE",
        }),
        expect.objectContaining({
          field: "provenance.rightsReference",
          code: "STAFF_TEXT_MARKUP",
        }),
      ]),
      { transaction: "boundary" },
    );
  });
  it("allows a clean draft with current validation evidence to enter review", async () => {
    await submitForReview(lead, {
      kind: "question",
      targetId: "018f0000-0000-7000-8000-000000000009",
    });
    expect(dependencies.recordValidation).not.toHaveBeenCalled();
    expect(dependencies.updateStatus).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      "in_review",
      { transaction: "boundary" },
    );
    expect(dependencies.recordReview).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      lead.id,
      "submitted",
      [],
      { transaction: "boundary" },
      "018f0000-0000-7000-8000-000000000010",
    );
  });
  it("blocks approval when findings lack a recorded exception", async () => {
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "in_review",
      part: "1",
      estimatedDurationSeconds: "60",
    });
    dependencies.latestValidation.mockResolvedValue({
      findings: [{ field: "prompt", code: "MISSING", message: "Missing" }],
    });
    await expect(
      approveContent(lead, {
        kind: "question",
        targetId: "018f0000-0000-7000-8000-000000000009",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(dependencies.updateStatus).not.toHaveBeenCalled();
  });
  it("requires persisted phone evidence for server-side image approval", async () => {
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "in_review",
      part: "1",
      estimatedDurationSeconds: "60",
      mediaType: "image",
      description: "Cat",
    });
    await expect(
      approveContent(lead, {
        kind: "media",
        targetId: "018f0000-0000-7000-8000-000000000009",
      }),
    ).rejects.toMatchObject({ code: "PHONE_PREVIEW_REQUIRED" });
    dependencies.hasPhonePreview.mockResolvedValue(true);
    await approveContent(lead, {
      kind: "media",
      targetId: "018f0000-0000-7000-8000-000000000009",
    });
    expect(dependencies.updateStatus).toHaveBeenCalledWith(
      "media",
      expect.any(String),
      "approved",
      { transaction: "boundary" },
    );
  });
  it("records a non-empty exception and makes a rejected review a new linked generated draft", async () => {
    dependencies.latestValidation.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000010",
      findings: [{ field: "prompt", code: "MISSING", message: "Missing" }],
    });
    await expect(
      acceptException(lead, {
        kind: "question",
        targetId: "018f0000-0000-7000-8000-000000000009",
        reason: "",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await acceptException(lead, {
      kind: "question",
      targetId: "018f0000-0000-7000-8000-000000000009",
      reason: "Reviewed exception",
    });
    expect(dependencies.recordReview).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      lead.id,
      "exception",
      expect.any(Array),
      { transaction: "boundary" },
      "018f0000-0000-7000-8000-000000000010",
      "Reviewed exception",
    );
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "in_review",
      origin: "generated",
      part: "1",
      estimatedDurationSeconds: "60",
    });
    dependencies.createQuestion.mockResolvedValue(
      "018f0000-0000-7000-8000-000000000011",
    );
    await expect(
      rejectContent(lead, {
        kind: "question",
        targetId: "018f0000-0000-7000-8000-000000000009",
        reason: "Needs clearer wording",
      }),
    ).resolves.toBe("018f0000-0000-7000-8000-000000000011");
    expect(dependencies.createQuestion).toHaveBeenCalledWith(
      input,
      lead.id,
      "generated",
      { transaction: "boundary" },
      expect.any(String),
    );
  });
  it("limits preview confirmation to successful 375px image media in review", async () => {
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "draft",
      part: "1",
      estimatedDurationSeconds: "60",
      mediaType: "image",
      description: "Cat",
    });
    await expect(
      recordPhonePreview(lead, {
        kind: "media",
        targetId: "018f0000-0000-7000-8000-000000000009",
        viewportWidth: 375,
        successful: true,
      }),
    ).rejects.toMatchObject({ code: "CONTENT_TRANSITION_CONFLICT" });
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "in_review",
      part: "1",
      estimatedDurationSeconds: "60",
      mediaType: "image",
      description: "Cat",
    });
    await recordPhonePreview(lead, {
      kind: "media",
      targetId: "018f0000-0000-7000-8000-000000000009",
      viewportWidth: 375,
      successful: true,
    });
    expect(dependencies.recordPhonePreview).toHaveBeenCalled();
  });
  it("does not let an exception for an older validation pass a newer finding set", async () => {
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "in_review",
      part: "1",
      estimatedDurationSeconds: "60",
    });
    dependencies.latestValidation.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000012",
      findings: [{ field: "prompt", code: "MISSING", message: "Missing" }],
    });
    await expect(
      approveContent(lead, {
        kind: "question",
        targetId: "018f0000-0000-7000-8000-000000000009",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(dependencies.hasExceptionForValidation).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      "018f0000-0000-7000-8000-000000000012",
      { transaction: "boundary" },
    );
  });
  it("uses an accepted validation result for exception, submission and approval", async () => {
    const validation = {
      id: "018f0000-0000-7000-8000-000000000010",
      findings: [{ field: "prompt", code: "MISSING", message: "Missing" }],
    };
    dependencies.latestValidation.mockResolvedValue(validation);
    dependencies.hasExceptionForValidation.mockResolvedValue(true);
    const targetId = "018f0000-0000-7000-8000-000000000009";
    await acceptException(lead, {
      kind: "question",
      targetId,
      reason: "Approved wording exception",
    });
    await submitForReview(lead, { kind: "question", targetId });
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: targetId,
      status: "in_review",
      part: "1",
      estimatedDurationSeconds: "60",
    });
    await approveContent(lead, { kind: "question", targetId });
    expect(dependencies.recordReview).toHaveBeenCalledWith(
      "question",
      targetId,
      lead.id,
      "exception",
      validation.findings,
      { transaction: "boundary" },
      validation.id,
      "Approved wording exception",
    );
    expect(dependencies.recordReview).toHaveBeenCalledWith(
      "question",
      targetId,
      lead.id,
      "submitted",
      validation.findings,
      { transaction: "boundary" },
      validation.id,
    );
    expect(dependencies.recordReview).toHaveBeenCalledWith(
      "question",
      targetId,
      lead.id,
      "approved",
      validation.findings,
      { transaction: "boundary" },
      validation.id,
    );
  });
  it("does not let an accepted exception bypass a newer validation result during submission", async () => {
    const targetId = "018f0000-0000-7000-8000-000000000009";
    dependencies.latestValidation.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000013",
      findings: [{ field: "provenance", code: "MISSING", message: "Missing" }],
    });
    dependencies.hasExceptionForValidation.mockResolvedValue(false);
    await expect(
      submitForReview(lead, { kind: "question", targetId }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(dependencies.hasExceptionForValidation).toHaveBeenCalledWith(
      "question",
      targetId,
      "018f0000-0000-7000-8000-000000000013",
      { transaction: "boundary" },
    );
    expect(dependencies.updateStatus).not.toHaveBeenCalled();
  });
  it("does not allow a rejected source version to be approved", async () => {
    dependencies.getContent.mockResolvedValue({
      ...input,
      id: "018f0000-0000-7000-8000-000000000009",
      status: "in_review",
      part: "1",
      estimatedDurationSeconds: "60",
    });
    dependencies.hasRejection.mockResolvedValue(true);
    await expect(
      approveContent(lead, {
        kind: "question",
        targetId: "018f0000-0000-7000-8000-000000000009",
      }),
    ).rejects.toMatchObject({ code: "CONTENT_REJECTED" });
    expect(dependencies.updateStatus).not.toHaveBeenCalled();
  });
  it("publishes only approved content with an audit event", async () => {
    dependencies.getContent.mockResolvedValue({ ...input, status: "approved" });
    await publishContent(lead, {
      kind: "question",
      targetId: "018f0000-0000-7000-8000-000000000009",
    });
    expect(dependencies.updateStatus).toHaveBeenCalledWith(
      "question",
      expect.any(String),
      "published",
      { transaction: "boundary" },
    );
    expect(dependencies.recordAudit).toHaveBeenCalledWith(
      "CONTENT_PUBLISHED",
      "question",
      expect.any(String),
      lead.id,
      { transaction: "boundary" },
    );
  });
  it("blocks invalid composition before a practice set is materialised", async () => {
    dependencies.getQuestions.mockResolvedValue([
      {
        ...input,
        id: "018f0000-0000-7000-8000-000000000009",
        status: "published",
        part: "1",
        estimatedDurationSeconds: "60",
      },
    ]);
    dependencies.getMediaVersions.mockResolvedValue([]);
    await expect(
      publishPracticeSet(lead, {
        questionIds: ["018f0000-0000-7000-8000-000000000009"],
        mediaByQuestion: [],
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "DURATION_OUT_OF_RANGE" }),
      ]),
    });
    expect(dependencies.createPublishedPracticeSet).not.toHaveBeenCalled();
  });
  it("returns mapping and audio findings without materialising a set", async () => {
    const questionId = "018f0000-0000-7000-8000-000000000009";
    const unmappedQuestionId = "018f0000-0000-7000-8000-000000000012";
    dependencies.getQuestions.mockResolvedValue([
      {
        ...input,
        id: questionId,
        status: "published",
        engine: "audio_picture_choice",
        part: "1",
        estimatedDurationSeconds: "300",
      },
    ]);
    dependencies.getMediaVersions.mockResolvedValue([]);
    await expect(
      publishPracticeSet(lead, {
        questionIds: [questionId],
        mediaByQuestion: [
          { questionId: unmappedQuestionId, mediaIds: [] },
          { questionId: unmappedQuestionId, mediaIds: [] },
        ],
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "MEDIA_MAPPING_QUESTION_NOT_SELECTED",
        }),
        expect.objectContaining({ code: "MEDIA_MAPPING_DUPLICATE" }),
      ]),
    });
    expect(dependencies.createPublishedPracticeSet).not.toHaveBeenCalled();
  });
  it("requires audio media even when an audio question has no mapping", async () => {
    const questionId = "018f0000-0000-7000-8000-000000000009";
    dependencies.getQuestions.mockResolvedValue([{ ...input, id: questionId, status: "published", engine: "audio_note_taking", part: "1", estimatedDurationSeconds: "300" }]);
    dependencies.getMediaVersions.mockResolvedValue([]);
    await expect(publishPracticeSet(lead, { questionIds: [questionId], mediaByQuestion: [] })).rejects.toMatchObject({ findings: expect.arrayContaining([expect.objectContaining({ code: "AUDIO_MEDIA_REQUIRED" })]) });
    expect(dependencies.createPublishedPracticeSet).not.toHaveBeenCalled();
  });
  it("publishes a valid set and snapshots an optional post-submission hint", async () => {
    const questionId = "018f0000-0000-7000-8000-000000000009";
    const question = {
      ...input,
      id: questionId,
      status: "published",
      part: "1",
      estimatedDurationSeconds: "300",
      postSubmitHint: { locale: "en-GB", message: "Look carefully at the picture." },
    };
    dependencies.getQuestions.mockResolvedValue([question]);
    dependencies.getMediaVersions.mockResolvedValue([]);
    dependencies.createPublishedPracticeSet.mockResolvedValue(
      "018f0000-0000-7000-8000-000000000014",
    );
    await expect(publishPracticeSet(lead, { questionIds: [questionId], mediaByQuestion: [] })).resolves.toBe("018f0000-0000-7000-8000-000000000014");
    expect(dependencies.createPublishedPracticeSet).toHaveBeenCalledWith(expect.objectContaining({ questions: [question], actorId: lead.id }), { transaction: "boundary" });
    expect(dependencies.recordPracticeSetAudit).toHaveBeenCalledWith("PRACTICE_SET_PUBLISHED", "018f0000-0000-7000-8000-000000000014", lead.id, { transaction: "boundary" });
  });
  it("uses dedicated practice-set audit evidence on retirement", async () => {
    dependencies.getPracticeSet.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000009",
      status: "published",
    });
    const { retirePracticeSet } =
      await import("@/features/content/application/content");
    await retirePracticeSet(lead, {
      practiceSetId: "018f0000-0000-7000-8000-000000000009",
    });
    expect(dependencies.recordPracticeSetAudit).toHaveBeenCalledWith(
      "PRACTICE_SET_RETIRED",
      expect.any(String),
      lead.id,
      { transaction: "boundary" },
    );
    expect(dependencies.recordAudit).not.toHaveBeenCalledWith(
      "PRACTICE_SET_RETIRED",
      "question",
      expect.anything(),
      lead.id,
      expect.anything(),
    );
  });
});
