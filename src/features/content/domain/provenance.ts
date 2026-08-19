import { createHash } from "node:crypto";
import type { GenerationRequest } from "./contracts";

const canonicalise = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalise) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalise(item)])) : value;
export const outputHash = (output: unknown) => createHash("sha256").update(JSON.stringify(canonicalise(output))).digest("hex");
export const generatedProvenance = (request: GenerationRequest, endpoint: string, model: string) => ({
  source: "AI draft gateway", rightsReference: "Generated draft requires academic review", gatewayKind: request.kind,
  endpoint, model, prompt: request.staffPrompt, references: request.permittedReferences,
});
