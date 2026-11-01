'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/domain/dates'
import { authClient } from '@/lib/auth/auth-client'

type PasskeyItem = { id: string; name?: string | null; createdAt?: Date | string | null }

export function Passkeys() {
  const list = authClient.useListPasskeys()
  const items = (list.data as PasskeyItem[] | null | undefined) ?? (list.isPending ? null : [])
  const [busy, setBusy] = useState(false)

  async function add() {
    setBusy(true)
    try {
      const res = await authClient.passkey.addPasskey({ name: `Passkey ${formatDate(new Date())}` })
      if (res?.error) toast.error(res.error.message ?? 'Could not add passkey')
      else toast.success('Passkey added')
      list.refetch()
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      const res = await authClient.passkey.deletePasskey({ id })
      if (res.error) toast.error(res.error.message ?? 'Could not delete passkey')
      list.refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {items?.length === 0 && <p className="text-sm text-muted-foreground">No passkeys yet.</p>}
        {items?.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{p.name || 'Passkey'}</div>
              {p.createdAt && (
                <div className="text-muted-foreground">
                  Added {formatDate(new Date(p.createdAt))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => remove(p.id)}>
              Delete
            </Button>
          </div>
        ))}
        <Button disabled={busy} onClick={add}>
          Add passkey
        </Button>
      </CardContent>
    </Card>
  )
}
