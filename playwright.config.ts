import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/usr/bin/google-chrome"
    }
  },
  webServer: {
    command: "node tests/e2e/start-server.mjs",
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e",
      GOOGLE_OIDC_CLIENT_ID: "test-client-id",
      GOOGLE_OIDC_CLIENT_SECRET: "test-client-secret",
      GOOGLE_OIDC_ISSUER: "https://accounts.google.com",
      GOOGLE_OIDC_REDIRECT_URI: "http://127.0.0.1:3100/api/auth/google/callback",
      ADMIN_EMAILS: "admin@example.test",
      MEDIA_BINARY_ORIGIN: "https://127.0.0.1:3443",
      MEDIA_SIGNING_SECRET: "e2e-media-signing-secret-that-is-long-enough",
      NODE_EXTRA_CA_CERTS: "tests/e2e/media-test-cert.pem",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false
  }
});
