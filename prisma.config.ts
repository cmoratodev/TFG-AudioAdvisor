// Load BOTH .env and .env.local (with .env.local taking precedence)
// so the Prisma CLI sees the same DATABASE_URL as the Next.js runtime.
import { config as loadEnv } from "dotenv";
loadEnv(); // .env
loadEnv({ path: ".env.local", override: true }); // .env.local overrides

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
