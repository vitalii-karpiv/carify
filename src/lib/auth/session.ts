import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './auth'

export type SessionUser = { id: string; email: string; name: string }

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const { id, email, name } = session.user
  return { id, email, name }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}
