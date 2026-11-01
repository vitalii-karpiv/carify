import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Vercel provides real env vars; locally load .env if present.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
