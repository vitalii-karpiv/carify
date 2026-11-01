import { requireUser } from '@/lib/auth/session'
import { SignOutButton } from './sign-out-button'

export default async function SettingsPage() {
  const user = await requireUser()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
      <SignOutButton />
    </div>
  )
}
