import "server-only";
import { serverConfig } from "@/shared/config/server";
import type { GenerationRequest } from "../domain/contracts";

// eslint-disable-next-line no-unused-vars
export class GatewayError extends Error { constructor(readonly code: string, message: string) { super(message); } }
/* output is the structured draft; image carries the generated binary for image requests. */
type GatewayResult = { endpoint: string; model: string; output: unknown; image?: Uint8Array };

/* Both gateways speak the OpenAI-compatible API: the configured endpoint is the API base (for example https://host/v1). */
const textInstructions = [
  "You draft original practice questions for Cambridge Pre A1 Starters learners aged 7 to 9.",
  "Write in simple British English using only words suitable for Pre A1 Starters.",
  "Never copy or imitate published Cambridge test content.",
  "Follow the engine, paper, part and guidance in the draft. Keep option values that are answer keys (such as true/false or yes/no) unchanged.",
  'Reply with one JSON object only: {"prompt": string, "options": string[]}. Use plain text without markup.',
].join(" ");
const imageStyle = "Simple, friendly flat illustration for young children on a plain light background. No text, letters or numbers in the picture.";

const decode = (value: string) => Uint8Array.from(Buffer.from(value, "base64"));
export const retryDelaysMs = [1_000, 2_000, 3_000, 5_000];
/* Transient gateway failures (5xx, 429 or a dropped connection) are retried with backoff; other failures return at once. */
async function send(url: string, init: NonNullable<Parameters<typeof fetch>[1]>) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok || (response.status < 500 && response.status !== 429) || attempt >= retryDelaysMs.length) return response;
    } catch (error) {
      if ((error instanceof Error && error.name === "AbortError") || attempt >= retryDelaysMs.length) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
  }
}

export async function generate(request: GenerationRequest): Promise<GatewayResult> {
  const config = request.kind === "text" ? { endpoint: serverConfig.AI_TEXT_ENDPOINT, model: serverConfig.AI_TEXT_MODEL, key: serverConfig.AI_TEXT_API_KEY } : { endpoint: serverConfig.AI_IMAGE_ENDPOINT, model: serverConfig.AI_IMAGE_MODEL, key: serverConfig.AI_IMAGE_API_KEY };
  if (!config.endpoint || !config.model || !config.key) throw new GatewayError("AI_DRAFT_PROVIDER_NOT_CONFIGURED", "The selected AI draft gateway is not configured.");
  const base = config.endpoint.replace(/\/$/, "");
  const references = request.permittedReferences.map((reference) => reference.description);
  const call = request.kind === "text"
    ? { url: `${base}/chat/completions`, body: { model: config.model, response_format: { type: "json_object" }, messages: [{ role: "system", content: textInstructions }, { role: "user", content: JSON.stringify({ draft: request.draft, staffPrompt: request.staffPrompt, permittedReferences: references }) }] } }
    : { url: `${base}/images/generations`, body: { model: config.model, n: 1, response_format: "b64_json", prompt: [request.staffPrompt, `Picture: ${request.draft.description}`, ...references.map((reference) => `Reference: ${reference}`), imageStyle].join("\n") } };
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), request.kind === "text" ? 90_000 : 240_000);
  try {
    const response = await send(call.url, { method: "POST", redirect: "error", signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${config.key}` }, body: JSON.stringify(call.body) });
    if (!response.ok) throw new GatewayError("AI_DRAFT_PROVIDER_FAILED", "The selected AI draft gateway did not produce a draft.");
    let payload: { choices?: { message?: { content?: unknown } }[]; data?: { b64_json?: unknown }[] };
    try { payload = await response.json(); } catch (error) { if (error instanceof Error && error.name === "AbortError") throw new GatewayError("AI_DRAFT_PROVIDER_TIMEOUT", "The selected AI draft gateway timed out."); throw new GatewayError("AI_DRAFT_PROVIDER_INVALID_RESPONSE", "The selected AI draft gateway returned an invalid response."); }
    if (request.kind === "text") {
      const content = payload.choices?.[0]?.message?.content;
      try {
        if (typeof content !== "string") throw new SyntaxError("missing content");
        return { endpoint: config.endpoint, model: config.model, output: JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")) };
      } catch { throw new GatewayError("AI_DRAFT_PROVIDER_INVALID_RESPONSE", "The selected AI draft gateway returned an invalid response."); }
    }
    const image = payload.data?.[0]?.b64_json;
    if (typeof image !== "string" || !image) throw new GatewayError("AI_DRAFT_PROVIDER_INVALID_RESPONSE", "The selected AI draft gateway returned an invalid response.");
    return { endpoint: config.endpoint, model: config.model, output: { description: request.draft.description }, image: decode(image) };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new GatewayError("AI_DRAFT_PROVIDER_TIMEOUT", "The selected AI draft gateway timed out.");
    throw new GatewayError("AI_DRAFT_PROVIDER_UNAVAILABLE", "The selected AI draft gateway is unavailable.");
  } finally { clearTimeout(timeout); }
}
