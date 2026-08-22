import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export default async function setup() {
  const requestedPaths = process.argv.filter((argument) =>
    argument.includes("tests/unit"),
  );
  if (
    requestedPaths.length &&
    !process.argv.some((argument) => argument.includes("tests/integration"))
  )
    return;
  const databaseName = `cambridgeyle_test_${process.pid}`;
  const databaseUrl = new URL(
    process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/cambridgeyle_test",
  );
  databaseUrl.pathname = `/${databaseName}`;
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, prepare: false });

  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  process.env.DATABASE_URL = databaseUrl.toString();
  const sql = postgres(databaseUrl.toString(), { max: 1, prepare: false });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "db/migrations" });
  } finally {
    await sql.end();
  }

  return async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
  };
}
