'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CarFront, Fuel, LayoutDashboard, Plus, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fuel', label: 'Fuel', icon: Fuel },
  { href: '/add', label: 'Add entry', icon: Plus },
  { href: '/service', label: 'Service', icon: Wrench },
  { href: '/vehicles', label: 'Vehicles', icon: CarFront },
] as const

const ADD_INDEX = 2

export function isTabActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomTabs() {
  const pathname = usePathname()
  const activeIndex = TABS.findIndex((t) => isTabActive(t.href, pathname))
  // The add button is its own highlight; the sliding pill marks the other tabs.
  const pillIndex = activeIndex === ADD_INDEX ? -1 : activeIndex

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-30 mx-auto max-w-sm rounded-full border border-(--glass-border) bg-(--glass) p-1.5 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.28),inset_0_1px_0_var(--glass-highlight)] backdrop-blur-xl backdrop-saturate-[1.8]"
    >
      <ul className="relative grid grid-cols-5">
        <li
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-1/5 rounded-full bg-(--glass-active) transition-[transform,opacity] duration-300 ease-out',
            pillIndex === -1 && 'opacity-0',
          )}
          style={{ transform: `translateX(${Math.max(pillIndex, 0) * 100}%)` }}
        />
        {TABS.map(({ href, label, icon: Icon }, i) => {
          const active = i === activeIndex
          return (
            <li key={href} className="relative flex justify-center">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-12 w-full items-center justify-center rounded-full transition-colors',
                  i === ADD_INDEX
                    ? 'w-12 bg-brand-gradient text-white shadow-brand active:scale-95'
                    : active
                      ? 'text-brand'
                      : 'text-(--nav-icon)',
                  i === ADD_INDEX && active && 'ring-2 ring-brand/40 ring-offset-2 ring-offset-transparent',
                )}
              >
                <Icon className={i === ADD_INDEX ? 'size-6' : 'size-[22px]'} strokeWidth={i === ADD_INDEX ? 2.5 : 2} />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
