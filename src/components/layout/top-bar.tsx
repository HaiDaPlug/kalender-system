'use client'

import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { Bell, LogOut } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Översikt',
  '/calendar': 'Kalender',
  '/bookings': 'Bokningar',
  '/jobs': 'Jobb',
  '/workers': 'Personal',
  '/settings': 'Inställningar',
}

export function TopBar({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const pathname = usePathname()

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    key === '/dashboard' ? pathname === key : pathname.startsWith(key)
  )?.[1] ?? 'Portal'

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.full_name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <header className="h-14 border-b border-border bg-background px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        <div className="h-3 w-px bg-border" />
        <span className="label-caps">
          {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {profile && (
          <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary select-none">
            {initials}
          </div>
        )}
        <button
          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Notifikationer"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          onClick={handleSignOut}
          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Logga ut"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}
