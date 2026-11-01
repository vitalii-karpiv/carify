'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteVehicleAction, setArchivedAction } from '../actions'

export function DangerZone({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setArchivedAction(id, !archived)
              router.push('/vehicles')
            })
          }
        >
          {archived ? 'Restore vehicle' : 'Archive vehicle'}
        </Button>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmName">
            Type <span className="font-semibold">{name}</span> to delete the vehicle and all its entries
          </Label>
          <Input id="confirmName" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            variant="destructive"
            disabled={pending || confirm.trim() === ''}
            onClick={() =>
              start(async () => {
                const res = await deleteVehicleAction(id, confirm)
                if (res && !res.ok) setError(res.error ?? 'Could not delete')
              })
            }
          >
            Delete vehicle
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
