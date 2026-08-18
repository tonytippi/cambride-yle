import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { parseServerConfig } from "./src/shared/config/environment";

const serverConfig = parseServerConfig(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/*.ts",
  out: "./db/migrations",
  dbCredentials: { url: serverConfig.DATABASE_URL }
});
