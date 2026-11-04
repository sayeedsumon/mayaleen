import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://mayaleen:mayaleen@localhost:5432/mayaleen_test", DIRECT_URL: process.env.TEST_DATABASE_URL ?? "postgresql://mayaleen:mayaleen@localhost:5432/mayaleen_test" }, include: ["tests/**/*.test.ts"], fileParallelism: false },
});
