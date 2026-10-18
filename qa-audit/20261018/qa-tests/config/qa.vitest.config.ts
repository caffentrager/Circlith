import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["qa/**/*.test.ts"], testTimeout: 300000, hookTimeout: 300000 } });
