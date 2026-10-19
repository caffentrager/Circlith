import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: process.env.CIRCLITH_TEST_URL || "http://127.0.0.1:5173",
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.CIRCLITH_TEST_URL ? undefined : {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
