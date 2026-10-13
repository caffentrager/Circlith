import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Repository Pages uses /Circlith/; local development stays at /.
  base: command === "build" ? "/Circlith/" : "/",
}));
