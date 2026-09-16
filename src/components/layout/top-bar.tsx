'use client'

import { usePathname } from 'next/navigation'

// Longest prefix wins, so /admin/job-reviews beats a hypothetical /admin.
const PAGE_TITLES: [prefix: string, title: string][] = [
  ['/dashboard',           'Översikt'],
  ['/calendar',            'Kalender'],
  ['/my-shifts',           'Mina pass'],
  ['/jobs',                'Jobb'],
  ['/admin/job-reviews',   'Granskning'],
  ['/admin/sms-templates', 'SMS-mallar'],
  ['/workers',             'Personal'],
  ['/bookings',            'Bokning'],
  ['/customers',           'Kund'],
  ['/settings',            'Inställningar'],
]

export function TopBar() {
  const pathname = usePathname()

  const title = PAGE_TITLES
    .filter(([prefix]) => prefix === '/dashboard' ? pathname === prefix : pathname.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'Portal'

  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <header className="h-14 border-b border-border bg-background px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-[0.95rem] font-semibold text-foreground tracking-tight truncate">{title}</h1>
        <div className="h-3.5 w-px bg-border-strong" />
        <span className="label-caps capitalize" suppressHydrationWarning>{today}</span>
      </div>
    </header>
  )
}
