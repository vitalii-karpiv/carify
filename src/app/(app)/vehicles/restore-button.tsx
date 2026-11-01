'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setArchivedAction } from './actions'

export function RestoreButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(async () => void (await setArchivedAction(id, false)))}
    >
      Restore
    </Button>
  )
}
