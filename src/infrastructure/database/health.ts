import { database } from "@/infrastructure/database/client";
import { sql } from "drizzle-orm";

export async function isDatabaseHealthy(timeoutMs = 1_000): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      database.execute(sql`select 1`),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Database health check timed out")), timeoutMs); })
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
