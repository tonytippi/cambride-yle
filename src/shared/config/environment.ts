import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((value) => value.startsWith("postgres:") || value.startsWith("postgresql:"), "must use a PostgreSQL URL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GOOGLE_OIDC_CLIENT_ID: z.string().min(1),
  GOOGLE_OIDC_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OIDC_ISSUER: z.url().refine((value) => value === "https://accounts.google.com", "must be the approved Google issuer"),
  GOOGLE_OIDC_REDIRECT_URI: z.url(),
  ADMIN_EMAILS: z.string().transform((value) => [...new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))])
  ,AI_DRAFT_PROVIDER_GATE_CLOSED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  AI_TEXT_ENDPOINT: z.url().optional(),
  AI_TEXT_MODEL: z.string().min(1).optional(),
  AI_TEXT_API_KEY: z.string().min(1).optional(),
  AI_IMAGE_ENDPOINT: z.url().optional(),
  AI_IMAGE_MODEL: z.string().min(1).optional(),
  AI_IMAGE_API_KEY: z.string().min(1).optional()
});

export type ServerConfig = z.infer<typeof serverEnvironmentSchema>;

export function parseServerConfig(environment: Record<string, string | undefined>): ServerConfig {
  const result = serverEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "configuration"))];
    throw new Error(`Invalid server configuration: ${keys.join(", ")}`);
  }
  return result.data;
}
