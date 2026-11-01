import { requireUser } from '@/lib/auth/session'
import { SignOutButton } from './sign-out-button'

// Placeholder: Task 14 replaces this with the real app shell.
export default async function HomePage() {
  const user = await requireUser()
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <p>Signed in as {user.email}</p>
      <SignOutButton />
    </main>
  )
}
