const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

// Mirrors how postgres.js (parseUrl) finds the host: the authority is the text after
// "://" up to the first "/" or "?", and the host is whatever follows the last "@",
// minus ":port". A URL parser (WHATWG) disagrees on e.g. "#", so both must agree.
function postgresJsHost(raw: string): string | null {
  const rest = raw.slice(raw.indexOf('://') + 3)
  const end = rest.search(/[/?]/)
  const authority = end === -1 ? rest : rest.slice(0, end)
  const hostPart = authority.slice(authority.lastIndexOf('@') + 1)
  const m = hostPart.match(/^([^:]*)(?::(\d*))?$/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

// Local-only guard. Also refuses `host`/`hostaddr` query params (postgres.js lets them
// override the URL host), commas (multi-host) and `#` (fragment vs host ambiguity).
export function isLocalDatabaseUrl(raw: string | undefined): boolean {
  if (!raw || raw.includes(',') || raw.includes('#')) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.searchParams.has('host') || url.searchParams.has('hostaddr')) return false
  const pgHost = postgresJsHost(raw)
  return pgHost !== null && LOCAL_HOSTS.has(pgHost) && pgHost === url.hostname
}
