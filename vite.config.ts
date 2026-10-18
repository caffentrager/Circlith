import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";

const sourceCommit = () => {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "unknown"; }
};

export default defineConfig(({ command, mode }) => ({
  plugins: [{
    // Stamp every production build with the commit it was built from so Pages assembly can verify it.
    name: "circlith-build-info", apply: "build",
    generateBundle() { this.emitFile({ type: "asset", fileName: "build-info.json", source: JSON.stringify({ commit: sourceCommit(), mode }) + "\n" }); },
  }],
  // Pages builds explicitly supply their base and editor/simulation mode in CI.
  // Local development stays at /; an ordinary build defaults to /Circlith/ as its base.
  base: command === "build" ? "/Circlith/" : "/",
}));
