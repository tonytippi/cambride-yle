import { afterEach, describe, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({ AI_TEXT_ENDPOINT: "https://text.example.test/v1", AI_TEXT_MODEL: "text-model", AI_TEXT_API_KEY: "text-secret", AI_IMAGE_ENDPOINT: "https://image.example.test/v1/", AI_IMAGE_MODEL: "image-model", AI_IMAGE_API_KEY: "image-secret" }));
vi.mock("@/shared/config/server", () => ({ serverConfig: config }));
import { generate } from "@/features/content/infrastructure/gateways";
const draft = { paper: "reading_writing" as const, part: 1, engine: "picture_true_false" as const, primaryTargetId: "018f0000-0000-7000-8000-000000000002", supportingTargetIds: [], topicIds: ["018f0000-0000-7000-8000-000000000003"], guidanceId: "018f0000-0000-7000-8000-000000000004", answerPolicyVersionId: "018f0000-0000-7000-8000-000000000005", prompt: "Cat", options: ["true"], estimatedDurationSeconds: 60, accessibilityMetadata: { altText: "Cat" }, provenance: { source: "Original", rightsReference: "Owned" } };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
const reply = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

describe("AI draft gateways", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("generates images through the OpenAI-compatible image endpoint with independent credentials and no protected data", async () => {
    const fetchMock = reply({ data: [{ b64_json: png }] });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generate({ kind: "image", staffPrompt: "Draw a cat", permittedReferences: [{ id: "018f0000-0000-7000-8000-000000000006", description: "Licensed style" }], draft: { ...draft, mediaType: "image", description: "Cat" } });
    expect(fetchMock).toHaveBeenCalledWith("https://image.example.test/v1/images/generations", expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal), headers: expect.objectContaining({ authorization: "Bearer image-secret" }) }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual(expect.objectContaining({ model: "image-model", n: 1, response_format: "b64_json" }));
    expect(body.prompt).toContain("Draw a cat");
    expect(body.prompt).toContain("Licensed style");
    expect(JSON.stringify(body)).not.toMatch(/learner|account|attempt|response\b|evidence|answer.?key|secret|signed/i);
    expect(result).toEqual({ endpoint: "https://image.example.test/v1/", model: "image-model", output: { description: "Cat" }, image: Uint8Array.from(Buffer.from(png, "base64")) });
  });

  it("drafts text through chat completions with a JSON response and parses the message content", async () => {
    const fetchMock = reply({ choices: [{ message: { content: '```json\n{"prompt":"Generated","options":["true","false"]}\n```' } }] });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generate({ kind: "text", staffPrompt: "Draft", permittedReferences: [], draft });
    expect(fetchMock).toHaveBeenCalledWith("https://text.example.test/v1/chat/completions", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer text-secret" }) }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual(expect.objectContaining({ model: "text-model", response_format: { type: "json_object" } }));
    expect(body.messages.map((message: { role: string }) => message.role)).toEqual(["system", "user"]);
    expect(result.output).toEqual({ prompt: "Generated", options: ["true", "false"] });
  });

  it("maps malformed or empty replies and HTTP failures to stable errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("bad json"); } }));
    await expect(generate({ kind: "text", staffPrompt: "Draft", permittedReferences: [], draft })).rejects.toMatchObject({ code: "AI_DRAFT_PROVIDER_INVALID_RESPONSE" });
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: "not json" } }] }));
    await expect(generate({ kind: "text", staffPrompt: "Draft", permittedReferences: [], draft })).rejects.toMatchObject({ code: "AI_DRAFT_PROVIDER_INVALID_RESPONSE" });
    vi.stubGlobal("fetch", reply({ data: [{ url: "https://cdn.example.test/cat.png" }] }));
    await expect(generate({ kind: "image", staffPrompt: "Draw", permittedReferences: [], draft: { ...draft, mediaType: "image", description: "Cat" } })).rejects.toMatchObject({ code: "AI_DRAFT_PROVIDER_INVALID_RESPONSE" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(generate({ kind: "text", staffPrompt: "Draft", permittedReferences: [], draft })).rejects.toMatchObject({ code: "AI_DRAFT_PROVIDER_FAILED" });
  });
});
