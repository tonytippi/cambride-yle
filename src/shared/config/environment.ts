import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((value) => value.startsWith("postgres:") || value.startsWith("postgresql:"), "must use a PostgreSQL URL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
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
