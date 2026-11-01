const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Guards by-id lookups: Postgres throws on malformed uuid input. */
export function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}
