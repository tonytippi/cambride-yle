import { createInterface } from "node:readline/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connectLocalDatabase } from "./local-database.ts";
import { seed } from "./db-seed.ts";

/* Drops every table and migration record in the local database, re-applies all migrations, then seeds test accounts. */
let database: ReturnType<typeof connectLocalDatabase> | undefined;
try {
  database = connectLocalDatabase();
  const { sql, name, host } = database;
  if (!process.argv.includes("--yes")) {
    if (!process.stdin.isTTY) throw new Error("Pass --yes to reset without a prompt.");
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question(`This deletes ALL data in "${name}" on ${host}. Type the database name to continue: `);
    prompt.close();
    if (answer.trim() !== name) throw new Error("Reset cancelled.");
  }
  await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(sql), { migrationsFolder: "db/migrations" });
  console.log(`Reset "${name}" and applied all migrations.`);
  if (!process.argv.includes("--no-seed")) await seed(sql);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database?.sql.end();
}
