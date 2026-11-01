import { describe, expect, it } from 'vitest'
import { isLocalDatabaseUrl, testDatabaseUrl } from './seed-guard'

describe('isLocalDatabaseUrl', () => {
  it.each([
    'postgres://u:p@localhost:5432/db',
    'postgres://u:p@127.0.0.1/db?sslmode=disable',
    'postgres://u:p@localhost',
  ])('accepts %s', (u) => expect(isLocalDatabaseUrl(u)).toBe(true))

  it.each([
    'postgres://u:p@localhost.evil.com/db',
    'postgres://u:p@localhost/db?host=prod.neon.tech',
    'postgres://u:p@localhost/db?hostaddr=10.0.0.1',
    'postgres://u:p@localhost,prod.neon.tech/db',
    'postgres://u:p@localhost#@prod.neon.tech/db',
    'postgres://u:p@prod.neon.tech#@localhost/db',
    'postgres://localhost@prod.neon.tech/db',
    'postgres://u:p@%6Cocalhost/db',
    'postgres://u:p@localhost:5432@prod.neon.tech/db',
    'postgres://u:p@/db',
    'not a url',
    '',
  ])('refuses %s', (u) => expect(isLocalDatabaseUrl(u)).toBe(false))

  it('refuses undefined', () => expect(isLocalDatabaseUrl(undefined)).toBe(false))
})

describe('testDatabaseUrl', () => {
  it('appends _test to the local database name', () => {
    expect(testDatabaseUrl('postgres://carify:carify@localhost:5432/carify')).toBe(
      'postgres://carify:carify@localhost:5432/carify_test',
    )
    expect(testDatabaseUrl('postgres://u:p@127.0.0.1/app?sslmode=disable')).toBe(
      'postgres://u:p@127.0.0.1/app_test?sslmode=disable',
    )
  })

  it('refuses non-local URLs and URLs without a database', () => {
    expect(() => testDatabaseUrl('postgres://u:p@ep-x.neon.tech/neondb')).toThrow()
    expect(() => testDatabaseUrl(undefined)).toThrow()
    expect(() => testDatabaseUrl('postgres://u:p@localhost:5432')).toThrow()
  })
})
