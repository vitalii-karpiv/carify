import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

if (existsSync('.env')) process.loadEnvFile('.env')
if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set and differ from DATABASE_URL (resetDb truncates tables)')
}
// Must happen before anything imports src/db/client.ts.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

let migrated = false

if (!migrated) {
  migrated = true
  const { db } = await import('./src/db/client')
  await migrate(db, { migrationsFolder: resolve(__dirname, 'drizzle') })
}
