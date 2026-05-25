import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  workers: 1, // serial to avoid session conflicts on production
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["line"]],
  use: {
    baseURL: "https://www.saproa.com",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
