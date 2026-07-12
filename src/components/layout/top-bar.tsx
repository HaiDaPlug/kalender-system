'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Översikt',
  '/calendar': 'Kalender',
  '/bookings': 'Bokningar',
  '/jobs': 'Jobb',
  '/workers': 'Personal',
  '/settings': 'Inställningar',
}

export function TopBar() {
  const pathname = usePathname()

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    key === '/dashboard' ? pathname === key : pathname.startsWith(key)
  )?.[1] ?? 'Portal'

  return (
    <header className="h-14 border-b border-border bg-background px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        <div className="h-3 w-px bg-border" />
        <span className="label-caps">
          {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>
    </header>
  )
}
