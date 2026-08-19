import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverConfig } from "@/shared/config/server";

const sql = postgres(serverConfig.DATABASE_URL, { max: 1, prepare: false });

export const database = drizzle(sql);
export async function closeDatabase(): Promise<void> { await sql.end(); }
