import { defineConfig } from "@playwright/test";
const port = Number(process.env.QA_PORT ?? 5290);
export default defineConfig({
  testDir: process.env.QA_TESTDIR ?? "./tests/browser",
  workers: Number(process.env.QA_WORKERS ?? 2),
  reporter: [["list"], ["json", { outputFile: process.env.QA_JSON ?? "../evidence/browser-results.json" }]],
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1280, height: 800 } },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
