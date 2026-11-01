'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CarFront, Fuel, LayoutDashboard, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fuel', label: 'Fuel', icon: Fuel },
  { href: '/service', label: 'Service', icon: Wrench },
  { href: '/vehicles', label: 'Vehicles', icon: CarFront },
] as const

export function isTabActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '/stats' || pathname.startsWith('/stats/')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomTabs() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isTabActive(href, pathname)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-xs',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
