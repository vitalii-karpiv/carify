const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

// postgres.js lets the `host`/`hostaddr` query params override the URL hostname,
// and a comma means multiple hosts, so those must not pass the local-only guard.
export function isLocalDatabaseUrl(raw: string | undefined): boolean {
  if (!raw || raw.includes(',')) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.searchParams.has('host') || url.searchParams.has('hostaddr')) return false
  return LOCAL_HOSTS.has(url.hostname)
}
