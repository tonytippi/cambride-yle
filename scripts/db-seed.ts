import { hashPassword } from "../src/features/identity/infrastructure/password.ts";
import { uuidv7 } from "../src/features/identity/infrastructure/uuid.ts";
import { connectLocalDatabase } from "./local-database.ts";

type SeedAccount = { email: string; displayName: string; role: "learner" | "teacher" | "academic_lead" | "admin" };

/* One account per role: two staff who can approve each other's sets, and two learners for comparing evidence. */
const seedAccounts: SeedAccount[] = [
  { email: "admin@test.local", displayName: "Test Admin", role: "admin" },
  { email: "lead@test.local", displayName: "Test Academic Lead", role: "academic_lead" },
  { email: "teacher@test.local", displayName: "Test Teacher", role: "teacher" },
  { email: "learner1@test.local", displayName: "Test Learner One", role: "learner" },
  { email: "learner2@test.local", displayName: "Test Learner Two", role: "learner" },
];

/* Adds the local test accounts; existing accounts with the same email are left untouched. */
export async function seed(sql: ReturnType<typeof connectLocalDatabase>["sql"]) {
  const password = process.env.SEED_PASSWORD ?? "cambridge-local-test";
  if (password.length < 12) throw new Error("SEED_PASSWORD must be at least 12 characters.");
  const passwordHash = await hashPassword(password);
  const created: string[] = [];
  for (const account of seedAccounts) {
    const id = uuidv7();
    const rows = await sql`INSERT INTO accounts (id, email, canonical_email, display_name, role, password_hash) VALUES (${id}, ${account.email}, ${account.email.toLowerCase()}, ${account.displayName}, ${account.role}, ${passwordHash}) ON CONFLICT (canonical_email) DO NOTHING RETURNING id`;
    if (!rows.length) continue;
    await sql`INSERT INTO audit_events (id, actor_id, action, target_id) VALUES (${uuidv7()}, NULL, 'ACCOUNT_CREATED', ${id})`;
    created.push(account.email);
  }
  console.log(created.length ? `Seeded ${created.length} account(s) with password "${password}":` : "Seed accounts already exist; nothing added.");
  for (const account of seedAccounts) console.log(`  ${account.role.padEnd(13)} ${account.email}${created.includes(account.email) ? "" : " (existing)"}`);
}

if (import.meta.main) {
  try {
    const { sql } = connectLocalDatabase();
    try { await seed(sql); } finally { await sql.end(); }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
