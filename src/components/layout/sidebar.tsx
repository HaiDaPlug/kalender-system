'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/types'
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  Briefcase,
  Settings,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Översikt', icon: LayoutDashboard },
  { href: '/calendar', label: 'Kalender', icon: CalendarDays },
  { href: '/bookings', label: 'Bokningar', icon: BookOpen },
  { href: '/jobs', label: 'Jobb', icon: Briefcase },
  { href: '/workers', label: 'Personal', icon: Users, adminOnly: true },
  { href: '/settings', label: 'Inställningar', icon: Settings },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administratör',
  manager: 'Chef',
  worker: 'Tekniker',
}

export function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()

  const visible = NAV.filter(
    item => !item.adminOnly || profile?.role === 'admin' || profile?.role === 'manager'
  )

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-sidebar">
      {/* Wordmark */}
      <div className="h-14 flex items-center px-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-primary" />
          <span
            className="text-sm font-700 tracking-widest uppercase text-foreground"
            style={{ letterSpacing: '0.18em' }}
          >
            RenGör
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {visible.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'group flex items-center gap-3 rounded px-3 py-2 text-sm transition-all duration-150',
              isActive(href)
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-colors',
                isActive(href) ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
              )}
              strokeWidth={isActive(href) ? 2.5 : 1.75}
            />
            <span>{label}</span>
            {isActive(href) && (
              <div className="ml-auto h-1 w-1 rounded-full bg-primary-foreground opacity-60" />
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
            {profile?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{profile?.full_name}</p>
            <p className="label-caps mt-0.5">{ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
