import "dotenv/config";
import postgres from "postgres";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/* Opens the DATABASE_URL connection only for a local, non-production database, so reset and seed can never touch a deployed one. */
export function connectLocalDatabase() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not set; add it to .env.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production.");
  if (!localHosts.has(url.hostname)) throw new Error(`Refusing to run against non-local host "${url.hostname}".`);
  return { sql: postgres(value, { max: 1, prepare: false, onnotice: () => {} }), name: url.pathname.slice(1), host: `${url.hostname}:${url.port || "5432"}` };
}
