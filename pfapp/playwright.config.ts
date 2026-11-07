import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: Chromium (the cached headless shell) drives the built app; tests/e2e/setup.ts starts it.
 * Not part of `bun run test` (CI runs that); `bun run test:e2e` runs this.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/setup.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { trace: "retain-on-failure", actionTimeout: 15_000 },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
    },
  ],
});
