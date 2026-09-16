'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { useLocalFlag } from '@/lib/hooks/use-local-flag'
import {
  rememberAccount,
  forgetAccount,
  parseKnownAccounts,
  getKnownAccountsSnapshot,
  getKnownAccountsServerSnapshot,
  subscribeKnownAccounts,
} from '@/lib/utils/known-accounts'
import type { Profile, UserRole } from '@/types'
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
  ChevronsUpDown,
  X,
} from 'lucide-react'

const COLLAPSE_STORAGE_KEY = 'sidebar-collapsed'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles?: UserRole[]
}

const MAIN_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Översikt',  icon: LayoutDashboard },
  { href: '/calendar',  label: 'Kalender',  icon: CalendarDays },
  { href: '/my-shifts', label: 'Mina pass', icon: CalendarClock },
  { href: '/jobs',      label: 'Jobb',      icon: Briefcase },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/job-reviews',   label: 'Granskning', icon: ScanEye,       roles: ['admin', 'manager'] },
  { href: '/admin/sms-templates', label: 'SMS-mallar', icon: MessageSquare, roles: ['admin'] },
  { href: '/workers',             label: 'Personal',   icon: Users,         roles: ['admin', 'manager'] },
]

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administratör',
  manager: 'Admin',
  worker:  'Personal',
}

type SidebarProfile = Pick<Profile, 'id' | 'email' | 'full_name' | 'role'>

export function Sidebar({ profile }: { profile: SidebarProfile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useLocalFlag(COLLAPSE_STORAGE_KEY)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  const knownAccountsRaw = useSyncExternalStore(
    subscribeKnownAccounts,
    getKnownAccountsSnapshot,
    getKnownAccountsServerSnapshot,
  )
  const knownAccounts = useMemo(() => parseKnownAccounts(knownAccountsRaw), [knownAccountsRaw])

  // Remember the signed-in account so the switcher can offer it later.
  useEffect(() => {
    if (profile) {
      rememberAccount({ email: profile.email, fullName: profile.full_name, role: profile.role })
    }
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
  }

  const canSee = (item: NavItem) => !item.roles || (profile !== null && item.roles.includes(profile.role))
  const adminItems = ADMIN_NAV.filter(canSee)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const renderItem = ({ href, label, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      title={collapsed ? label : undefined}
      data-active={isActive(href)}
      data-collapsed={collapsed}
      className="nav-item"
    >
      <Icon strokeWidth={isActive(href) ? 2.25 : 1.75} />
      {!collapsed && <span>{label}</span>}
    </Link>
  )

  return (
    <aside
      className={cn(
        'shrink-0 flex flex-col border-r border-border bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand */}
      <div className={cn('h-14 border-b border-border shrink-0 flex items-center gap-2.5', collapsed ? 'justify-center px-0' : 'px-4')}>
        <div className="brand-mark" aria-hidden>K</div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="text-[0.9rem] font-semibold tracking-tight truncate">KOM-fort</p>
            <p className="label-caps" style={{ fontSize: '0.58rem', letterSpacing: '0.16em' }}>Bilvård</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {MAIN_NAV.map(renderItem)}

        {adminItems.length > 0 && (
          <>
            <div className={cn('pt-4 pb-1.5', collapsed ? 'px-2' : 'px-3')}>
              {collapsed
                ? <div className="h-px bg-border" />
                : <p className="label-caps" style={{ fontSize: '0.6rem' }}>Administration</p>}
            </div>
            {adminItems.map(renderItem)}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandera meny' : 'Fäll ihop meny'}
          className={cn('btn btn-ghost btn-sm', collapsed ? 'btn-icon w-full' : 'w-full justify-start')}
        >
          {collapsed ? <PanelLeftOpen strokeWidth={1.75} /> : <PanelLeftClose strokeWidth={1.75} />}
          {!collapsed && <span className="text-xs">Fäll ihop</span>}
        </button>
      </div>

      {/* Account section */}
      <div ref={accountRef} className="relative border-t border-border p-2">
        {accountMenuOpen && (
          <div
            className={cn(
              'menu absolute z-50 w-60 animate-scale-in',
              collapsed ? 'left-full bottom-2 ml-2' : 'right-2 bottom-full mb-2'
            )}
          >
            {knownAccounts.length > 0 && (
              <div className="py-1 border-b border-border">
                <p className="label-caps px-3 pt-1.5 pb-1.5">Konton</p>
                {knownAccounts.map(account => {
                  const isCurrent = account.email === profile?.email
                  return (
                    <div key={account.email} className="group/acc flex items-center">
                      <button
                        onClick={() => !isCurrent && void handleSwitchAccount(account.email)}
                        disabled={isCurrent}
                        className={cn(
                          'menu-item flex-1 min-w-0 py-1.5',
                          isCurrent && 'text-foreground font-medium cursor-default hover:bg-transparent'
                        )}
                      >
                        <div className="avatar avatar-sm">{account.fullName?.charAt(0) ?? '?'}</div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{account.fullName}</span>
                          <span className="block truncate text-[11px] text-muted-foreground font-normal">{account.email}</span>
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
            <button onClick={handleSignOut} className="menu-item py-2.5">
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
            'w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-secondary transition-colors',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className="avatar">{profile?.full_name?.charAt(0) ?? '?'}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[0.8rem] font-semibold text-foreground truncate">{profile?.full_name}</p>
                <p className="label-caps mt-0.5" style={{ fontSize: '0.6rem' }}>{ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}</p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}
