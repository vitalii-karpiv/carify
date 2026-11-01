import { describe, expect, it } from 'vitest'
import { isLocalDatabaseUrl } from './seed-guard'

describe('isLocalDatabaseUrl', () => {
  it.each([
    'postgres://u:p@localhost:5432/db',
    'postgres://u:p@127.0.0.1/db?sslmode=disable',
  ])('accepts %s', (u) => expect(isLocalDatabaseUrl(u)).toBe(true))

  it.each([
    'postgres://u:p@localhost.evil.com/db',
    'postgres://u:p@localhost/db?host=prod.neon.tech',
    'postgres://u:p@localhost/db?hostaddr=10.0.0.1',
    'postgres://u:p@localhost,prod.neon.tech/db',
    'not a url',
    '',
  ])('refuses %s', (u) => expect(isLocalDatabaseUrl(u)).toBe(false))

  it('refuses undefined', () => expect(isLocalDatabaseUrl(undefined)).toBe(false))
})
