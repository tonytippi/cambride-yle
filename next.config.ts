import type { NextConfig } from "next";
import { parseServerConfig } from "./src/shared/config/environment";

// Next loads this config for linting too. Production validates its complete runtime
// configuration at build time; the server module validates it when the app starts.
if (process.env.NODE_ENV === "production") parseServerConfig(process.env);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
      ]
    }];
  }
};

export default nextConfig;
