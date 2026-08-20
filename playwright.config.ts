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
    command: "npm run dev -- --port 3100",
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e",
      GOOGLE_OIDC_CLIENT_ID: "test-client-id",
      GOOGLE_OIDC_CLIENT_SECRET: "test-client-secret",
      GOOGLE_OIDC_ISSUER: "https://accounts.google.com",
      GOOGLE_OIDC_REDIRECT_URI: "http://127.0.0.1:3100/api/auth/google/callback",
      ADMIN_EMAILS: "admin@example.test",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false
  }
});
