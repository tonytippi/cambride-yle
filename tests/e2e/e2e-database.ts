import { readFile } from "node:fs/promises";
import type postgres from "postgres";

export const e2eDatabaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e";

/* Recreates the disposable E2E schema from every migration in journal order, so browser tests run on the production schema. */
export async function resetE2eSchema(sql: postgres.Sql) {
  if (!new URL(e2eDatabaseUrl).pathname.endsWith("_e2e")) throw new Error("Browser E2E requires a dedicated *_e2e database.");
  const journal = JSON.parse(await readFile("db/migrations/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  for (const { tag } of journal.entries) await sql.unsafe(await readFile(`db/migrations/${tag}.sql`, "utf8"));
}

type Transaction = postgres.TransactionSql;
const uuid = () => crypto.randomUUID();

/* Moves a seeded draft set through submission and independent approval, as the lifecycle triggers require. */
export async function approveSeededSet(tx: Transaction, setId: string, submitterId: string, approverId: string) {
  await tx`INSERT INTO practice_set_review_records (id, practice_set_id, actor_id, decision) VALUES (${uuid()}, ${setId}, ${submitterId}, 'submitted')`;
  await tx`UPDATE practice_sets SET status = 'in_review' WHERE id = ${setId}`;
  await tx`INSERT INTO practice_set_review_records (id, practice_set_id, actor_id, decision) VALUES (${uuid()}, ${setId}, ${approverId}, 'approved')`;
  await tx`UPDATE practice_sets SET status = 'approved' WHERE id = ${setId}`;
}

/* Writes an approved set's snapshot rows inside its publication scope, then publishes it. */
export async function publishSeededSet(tx: Transaction, setId: string, writeSnapshot: () => Promise<unknown>) {
  await tx`SELECT set_config('app.practice_set_publication_id', ${setId}, true)`;
  await writeSnapshot();
  await tx`UPDATE practice_sets SET status = 'published' WHERE id = ${setId}`;
}
