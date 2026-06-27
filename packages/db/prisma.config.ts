import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Turbo always sets CWD to the workspace root (packages/db), so ../../.env is the repo root.
// Load repo root first, then allow a local packages/db/.env to override.
config({ path: "../../.env", override: false });
config({ path: ".env", override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Fallback keeps `prisma generate` working without a real DB (e.g. CI pipelines).
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/placeholder",
  },
});
