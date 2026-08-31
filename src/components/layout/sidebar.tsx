'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { getKnownAccounts, rememberAccount, forgetAccount, type KnownAccount } from '@/lib/utils/known-accounts'
import type { Profile } from '@/types'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Briefcase,
  CalendarClock,
  ScanEye,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Bell,
  ChevronsUpDown,
  X,
  Menu,
} from 'lucide-react'

const COLLAPSE_STORAGE_KEY = 'sidebar-collapsed'

const NAV = [
  { href: '/dashboard',          label: 'Översikt',      icon: LayoutDashboard },
  { href: '/calendar',           label: 'Kalender',      icon: CalendarDays },
  { href: '/my-shifts',          label: 'Mina pass',     icon: CalendarClock },
  { href: '/jobs',               label: 'Jobb',          icon: Briefcase },
  { href: '/admin/job-reviews',   label: 'Granskning',  icon: ScanEye,        adminOnly: true },
  { href: '/admin/sms-templates', label: 'SMS-mallar',  icon: MessageSquare,  adminOnly: true, adminStrictOnly: true },
  { href: '/workers',             label: 'Personal',    icon: Users,          adminOnly: true },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administratör',
  manager: 'Admin',
  worker: 'Personal',
}

export function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  // Mobilluckan: på smal skärm ligger menyn utanför skärmen tills man
  // trycker på hamburgaren. Påverkar inte `collapsed` (desktoplägets w-16).
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [knownAccounts, setKnownAccounts] = useState<KnownAccount[]>([])
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true')
  }, [])

  useEffect(() => {
    if (profile) {
      rememberAccount({ email: profile.email, fullName: profile.full_name, role: profile.role })
    }
    setKnownAccounts(getKnownAccounts())
  }, [profile])

  useEffect(() => {
    if (!accountMenuOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setAccountMenuOpen(false)
        return
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [accountMenuOpen])

  // Escape stänger mobilluckan, och sidan bakom ska inte kunna scrollas.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next))
      return next
    })
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleSwitchAccount = async (email: string) => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/login?email=${encodeURIComponent(email)}`)
  }

  const handleForgetAccount = (e: React.MouseEvent, email: string) => {
    e.stopPropagation()
    forgetAccount(email)
    setKnownAccounts(getKnownAccounts())
  }

  const visible = NAV.filter(item => {
    if (item.adminStrictOnly) return profile?.role === 'admin'
    if (item.adminOnly) return profile?.role === 'admin' || profile?.role === 'manager'
    return true
  })

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Hamburgarknapp — ligger i topbarens vänstra hörn på mobil */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Öppna meny"
        aria-expanded={mobileOpen}
        className="md:hidden fixed top-0 left-0 z-40 h-14 w-14 flex items-center justify-center text-muted-foreground active:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mörk bakgrund bakom den utfällda menyn */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-200',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

    <aside
      className={cn(
        'flex flex-col border-r border-border bg-sidebar',
        // Mobil: fast positionerad lucka som glider in från vänster.
        'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ease-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: tillbaka till Hais statiska kolumn med hopfällbart läge.
        'md:static md:translate-x-0 md:shrink-0 md:z-auto md:transition-[width] md:duration-200',
        collapsed ? 'md:w-16' : 'md:w-56'
      )}
    >
      <div className="h-14 border-b border-border shrink-0" />

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {visible.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? label : undefined}
            className={cn(
              'group flex items-center gap-3 rounded px-3 py-2 text-sm transition-all duration-200',
              collapsed && 'justify-center px-0',
              isActive(href)
                ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary hover:translate-x-0.5'
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-colors',
                isActive(href) ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
              )}
              strokeWidth={isActive(href) ? 2.5 : 1.75}
            />
            {!collapsed && <span>{label}</span>}
            {!collapsed && isActive(href) && (
              <div className="ml-auto h-1 w-1 rounded-full bg-primary-foreground opacity-60" />
            )}
          </Link>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandera meny' : 'Fäll ihop meny'}
          className="w-full flex items-center justify-center rounded px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      </div>

      {/* Notifications */}
      <div className="border-t border-border p-2">
        <button
          aria-label="Notifikationer"
          className="w-full flex items-center justify-center rounded px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Account section */}
      <div ref={accountRef} className="relative border-t border-border p-2">
        {accountMenuOpen && (
          <div
            className={cn(
              'absolute z-50 w-56 rounded border border-border bg-popover shadow-md overflow-hidden animate-scale-in',
              collapsed ? 'left-full bottom-2 ml-2' : 'right-2 bottom-full mb-2'
            )}
          >
            {knownAccounts.length > 0 && (
              <div className="py-1 border-b border-border">
                <p className="label-caps px-3 pt-1 pb-1.5 text-muted-foreground">Konton</p>
                {knownAccounts.map(account => {
                  const isCurrent = account.email === profile?.email
                  return (
                    <div
                      key={account.email}
                      className="group/acc flex items-center"
                    >
                      <button
                        onClick={() => !isCurrent && void handleSwitchAccount(account.email)}
                        disabled={isCurrent}
                        className={cn(
                          'flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors',
                          isCurrent
                            ? 'text-foreground font-medium cursor-default'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        )}
                      >
                        <div className="h-5 w-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                          {account.fullName?.charAt(0) ?? '?'}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{account.fullName}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{account.email}</span>
                        </span>
                        {isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      </button>
                      {!isCurrent && (
                        <button
                          onClick={(e) => handleForgetAccount(e, account.email)}
                          aria-label={`Glöm ${account.email}`}
                          className="px-2 py-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/acc:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Logga ut
            </button>
          </div>
        )}
        <button
          onClick={() => setAccountMenuOpen(prev => !prev)}
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          aria-label="Konto"
          title={collapsed ? profile?.full_name ?? 'Konto' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 rounded px-2 py-2 text-left hover:bg-secondary transition-colors',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {profile?.full_name?.charAt(0) ?? '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{profile?.full_name}</p>
                <p className="label-caps mt-0.5">{ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}</p>
              </div>
              <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.75} />
            </div>
          )}
        </button>
      </div>
    </aside>
    </>
  )
}
