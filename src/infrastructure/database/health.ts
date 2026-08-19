import postgres from "postgres";
import { serverConfig } from "@/shared/config/server";

export async function isDatabaseHealthy(timeoutMs = 1_000): Promise<boolean> {
  const healthClient = postgres(serverConfig.DATABASE_URL, { max: 1, prepare: false });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      healthClient`select 1`,
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Database health check timed out")), timeoutMs); })
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
    await healthClient.end({ timeout: 0 });
  }
}
