import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" blocca l'import lato client in Next; nei test non serve
      "server-only": path.resolve(__dirname, "src/test/empty.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
