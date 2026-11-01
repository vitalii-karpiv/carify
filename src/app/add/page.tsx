import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SyncBanners } from '@/components/sync/sync-banners'
import { AddEntry } from './add-entry'

// Static shell: no server data, no session. Precached by the service worker.
export default function AddPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-md items-center gap-2 px-2">
          <Link href="/" aria-label="Back" className="flex size-9 items-center justify-center rounded-lg">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold">Add entry</h1>
        </div>
      </header>
      <SyncBanners />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <Suspense>
          <AddEntry />
        </Suspense>
      </main>
    </div>
  )
}
