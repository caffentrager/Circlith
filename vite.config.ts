import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Pages builds explicitly supply their base and editor/simulation mode in CI.
  // Local development stays at /; an ordinary build defaults to /Circlith/ as its base.
  base: command === "build" ? "/Circlith/" : "/",
}));
