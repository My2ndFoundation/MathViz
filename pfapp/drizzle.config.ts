import { defineConfig } from "drizzle-kit";

// `bun run db:generate` writes app/drizzle/. Only generation uses this file: migrations run in the
// app's own process (app/src/lib/db/open.ts), so no database URL is needed here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./app/src/lib/db/schema.ts",
  out: "./app/drizzle",
  strict: true,
  verbose: true,
});
