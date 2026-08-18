import "server-only";
import { parseServerConfig } from "@/shared/config/environment";

export { parseServerConfig } from "@/shared/config/environment";
export type { ServerConfig } from "@/shared/config/environment";

export const serverConfig = parseServerConfig(process.env);
