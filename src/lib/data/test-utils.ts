import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { user } from '@/db/schema'

const TABLES = [
  'energy_entry',
  'service_entry',
  'vehicle',
  'session',
  'passkey',
  'account',
  'verification',
  'user',
]

export async function resetDb(): Promise<void> {
  const list = TABLES.map((t) => `"${t}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`))
}

export async function createTestUser(
  email: string = `${randomUUID()}@test.local`,
): Promise<{ id: string }> {
  const id = randomUUID()
  await db.insert(user).values({
    id,
    name: 'Test User',
    email,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return { id }
}
