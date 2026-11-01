import { BottomTabs } from '@/components/shell/bottom-tabs'
import { Fab } from '@/components/shell/fab'
import { TopBar } from '@/components/shell/top-bar'
import { requireUser } from '@/lib/auth/session'
import { listVehicles } from '@/lib/data/vehicles'
import { getSelectedVehicle } from '@/lib/vehicle-selection'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()
  const [vehicles, selected] = await Promise.all([listVehicles(user.id), getSelectedVehicle(user.id)])

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
        selectedId={selected?.id ?? null}
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
        {children}
      </main>
      <Fab />
      <BottomTabs />
    </div>
  )
}
