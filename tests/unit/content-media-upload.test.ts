import { beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({
  createMedia: vi.fn(), getMedia: vi.fn(), getContent: vi.fn(), getControlledReferences: vi.fn(), recordValidation: vi.fn(), resolvePermittedTextReferences: vi.fn(), recordGeneration: vi.fn(), recordAudit: vi.fn(),
  hasObject: vi.fn(), putObject: vi.fn(), generate: vi.fn(),
}));
const config = vi.hoisted(() => ({ AI_DRAFT_PROVIDER_GATE_CLOSED: true }));
/* eslint-disable-next-line no-unused-vars */
vi.mock("@/infrastructure/database/client", () => ({ database: { transaction: async (boundary: (...args: [object]) => unknown) => boundary({ transaction: "boundary" }) } }));
vi.mock("@/features/content/infrastructure/repositories", () => dependencies);
vi.mock("@/infrastructure/storage/object-store", () => ({ isObjectStoreWritable: () => true, hasObject: dependencies.hasObject, putObject: dependencies.putObject }));
vi.mock("@/features/content/infrastructure/gateways", () => ({ GatewayError: class extends Error {}, generate: dependencies.generate }));
vi.mock("@/shared/config/server", () => ({ serverConfig: config }));
import { createHash } from "node:crypto";
import { createManualMedia, requestAiDraft, reviseMedia, validateContent } from "@/features/content/application/content";

const lead = { id: "018f0000-0000-7000-8000-000000000001", email: "lead@example.test", displayName: "Lead", role: "academic_lead" as const };
const media = {
  paper: "reading_writing" as const, part: 1, engine: "picture_true_false" as const,
  primaryTargetId: "018f0000-0000-7000-8000-000000000002", supportingTargetIds: [], topicIds: ["018f0000-0000-7000-8000-000000000003"], guidanceId: "018f0000-0000-7000-8000-000000000004",
  estimatedDurationSeconds: 60, accessibilityMetadata: { altText: "A cat on a mat" }, provenance: { source: "Centre-created", rightsReference: "Centre-owned" },
  mediaType: "image" as const, description: "A cat on a mat",
};
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const sha = createHash("sha256").update(png).digest("hex");
const stored = { objectKey: `media/${sha}`, contentType: "image/png", byteSize: png.byteLength, contentSha256: sha };
const sourceId = "018f0000-0000-7000-8000-000000000009";

describe("media file uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getControlledReferences.mockResolvedValue({ targets: [{ id: media.primaryTargetId, isApproved: true }, { id: media.topicIds[0], isApproved: true }], guidance: { paper: media.paper, part: media.part, engine: media.engine, maxWords: 10, maxOptions: 2 } });
    dependencies.createMedia.mockResolvedValue("018f0000-0000-7000-8000-000000000010");
    dependencies.hasObject.mockResolvedValue(false);
    dependencies.resolvePermittedTextReferences.mockResolvedValue([]);
  });

  it("stores an allow-listed file content-addressed before recording the media version", async () => {
    await createManualMedia(lead, media, { bytes: png });
    expect(dependencies.putObject).toHaveBeenCalledWith(stored.objectKey, png, "image/png");
    expect(dependencies.createMedia).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "image" }), lead.id, "manual", { transaction: "boundary" }, undefined, stored);
    dependencies.hasObject.mockResolvedValue(true);
    await createManualMedia(lead, media, { bytes: png });
    expect(dependencies.putObject).toHaveBeenCalledTimes(1);
  });

  it("rejects a file whose bytes do not match the media type, without storing it", async () => {
    await expect(createManualMedia(lead, { ...media, mediaType: "audio" }, { bytes: png })).rejects.toMatchObject({ code: "VALIDATION_FAILED", findings: [expect.objectContaining({ code: "MEDIA_FILE_TYPE_MISMATCH" })] });
    expect(dependencies.putObject).not.toHaveBeenCalled();
    expect(dependencies.createMedia).not.toHaveBeenCalled();
  });

  it("keeps the source file on a revision without a new upload, and drops it when the media type changes", async () => {
    dependencies.getMedia.mockResolvedValue({ id: sourceId, mediaType: "image", ...stored });
    await reviseMedia(lead, sourceId, media);
    expect(dependencies.createMedia).toHaveBeenLastCalledWith(expect.anything(), lead.id, "manual", { transaction: "boundary" }, sourceId, stored);
    await reviseMedia(lead, sourceId, { ...media, mediaType: "audio" });
    expect(dependencies.createMedia).toHaveBeenLastCalledWith(expect.anything(), lead.id, "manual", { transaction: "boundary" }, sourceId, undefined);
  });

  it("records a non-exceptionable finding when validated media has no file", async () => {
    dependencies.getContent.mockResolvedValue({ ...media, id: sourceId, status: "draft", part: "1", estimatedDurationSeconds: "60", objectKey: null });
    await validateContent(lead, { kind: "media", targetId: sourceId });
    expect(dependencies.recordValidation).toHaveBeenCalledWith("media", sourceId, lead.id, expect.arrayContaining([expect.objectContaining({ code: "MEDIA_FILE_REQUIRED" })]), { transaction: "boundary" });
  });

  it("stores a generated image as the generated media version's file", async () => {
    dependencies.generate.mockResolvedValue({ endpoint: "https://image.example.test/v1", model: "image-model", output: { description: media.description }, image: png });
    await requestAiDraft(lead, { kind: "image", staffPrompt: "Draw a cat on a mat", permittedReferences: [], draft: media });
    expect(dependencies.putObject).toHaveBeenCalledWith(stored.objectKey, png, "image/png");
    expect(dependencies.createMedia).toHaveBeenCalledWith(expect.objectContaining({ description: media.description }), lead.id, "generated", { transaction: "boundary" }, undefined, stored);
  });
});
