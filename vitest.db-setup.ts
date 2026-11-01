import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { testDatabaseUrl } from './src/db/seed-guard'

if (existsSync('.env')) process.loadEnvFile('.env')
// resetDb truncates tables, so tests always run against `<db>_test` on a local server.
// Must happen before anything imports src/db/client.ts.
process.env.DATABASE_URL = testDatabaseUrl(process.env.DATABASE_URL)

let migrated = false

if (!migrated) {
  migrated = true
  const { db } = await import('./src/db/client')
  await migrate(db, { migrationsFolder: resolve(__dirname, 'drizzle') })
}
