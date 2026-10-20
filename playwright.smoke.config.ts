import { defineConfig } from "@playwright/test";

/* Opt-in smoke test against a running Docker Compose stack with the real object store and AI gateways. It writes "Smoke" records. */
export default defineConfig({
  testDir: "./tests/smoke",
  outputDir: "test-results/smoke",
  timeout: 25 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:9100",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/usr/bin/google-chrome" },
  },
});
