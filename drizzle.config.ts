import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const databaseUrl = z.url().refine((value) => value.startsWith("postgres:") || value.startsWith("postgresql:"), "DATABASE_URL must use a PostgreSQL URL").parse(process.env.DATABASE_URL);

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/*.ts",
  out: "./db/migrations",
  dbCredentials: { url: databaseUrl }
});
