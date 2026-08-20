import "server-only";
import { serverConfig } from "@/shared/config/server";
import type { GenerationRequest } from "../domain/contracts";

// eslint-disable-next-line no-unused-vars
export class GatewayError extends Error { constructor(readonly code: string, message: string) { super(message); } }
type GatewayResult = { endpoint: string; model: string; output: unknown };
export async function generate(request: GenerationRequest): Promise<GatewayResult> {
  const config = request.kind === "text" ? { endpoint: serverConfig.AI_TEXT_ENDPOINT, model: serverConfig.AI_TEXT_MODEL, key: serverConfig.AI_TEXT_API_KEY } : { endpoint: serverConfig.AI_IMAGE_ENDPOINT, model: serverConfig.AI_IMAGE_MODEL, key: serverConfig.AI_IMAGE_API_KEY };
  if (!config.endpoint || !config.model || !config.key) throw new GatewayError("AI_DRAFT_PROVIDER_NOT_CONFIGURED", "The selected AI draft gateway is not configured.");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(config.endpoint, { method: "POST", redirect: "error", signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${config.key}` }, body: JSON.stringify({ model: config.model, input: { guidance: request.draft, staffPrompt: request.staffPrompt, permittedReferences: request.permittedReferences } }) });
    if (!response.ok) throw new GatewayError("AI_DRAFT_PROVIDER_FAILED", "The selected AI draft gateway did not produce a draft.");
    try { return { endpoint: config.endpoint, model: config.model, output: await response.json() }; } catch (error) { if (error instanceof Error && error.name === "AbortError") throw new GatewayError("AI_DRAFT_PROVIDER_TIMEOUT", "The selected AI draft gateway timed out."); throw new GatewayError("AI_DRAFT_PROVIDER_INVALID_RESPONSE", "The selected AI draft gateway returned an invalid response."); }
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new GatewayError("AI_DRAFT_PROVIDER_TIMEOUT", "The selected AI draft gateway timed out.");
    throw new GatewayError("AI_DRAFT_PROVIDER_UNAVAILABLE", "The selected AI draft gateway is unavailable.");
  } finally { clearTimeout(timeout); }
}
