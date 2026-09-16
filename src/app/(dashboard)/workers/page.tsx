'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, UserCheck, UserX, ChevronDown, Plus, X, Info, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, UserRole } from '@/types'
import { cn } from '@/lib/utils/cn'
import { PageHeader } from '@/components/ui/page-header'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  admin:   { label: 'Administratör', color: 'var(--role-admin)' },
  manager: { label: 'Admin',         color: 'var(--role-manager)' },
  worker:  { label: 'Personal',      color: 'var(--role-worker)' },
}

// Permissions per role — matches actual enforcement in the API routes
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin:   ['Se kalender', 'Skapa bokningar', 'Redigera bokningar', 'Ta bort bokningar', 'Hantera personal', 'Granska jobb', 'Godkänna/avvisa bokningar', 'Godkänna pass', 'Redigera SMS-mall'],
  manager: ['Se kalender', 'Skapa bokningar', 'Granska jobb', 'Godkänna/avvisa bokningar', 'Godkänna pass', 'Redigera kundanteckningar'],
  worker:  ['Se kalender', 'Skicka in bokningar (kräver godkännande)', 'Ladda upp jobbfoton', 'Hantera egna pass'],
}

const ROLE_DESCRIPTIONS: Record<UserRole, { title: string; description: string; useCase: string }> = {
  admin: {
    title: 'Administratör — superadmin',
    description: 'Kan göra allt i systemet: skapa och redigera bokningar, hantera personal, godkänna eller avvisa biljobb och se hela kalendern.',
    useCase: 'Används av ägaren. Bör bara finnas på ett eller två konton.',
  },
  manager: {
    title: 'Admin — delegerad godkännanderätt',
    description: 'Kan godkänna och avvisa inkommande bokningar, pass och jobb precis som Administratören. Kan inte redigera eller ta bort bokningar eller hantera personal.',
    useCase: 'Ge denna roll till någon du litar på när du är bortrest eller otillgänglig. De kan hålla flödet igång utan att ha full kontroll.',
  },
  worker: {
    title: 'Personal — standardroll',
    description: 'Kan skicka in nya bokningar via kalendern. Bokningen hamnar som "väntar" och måste godkännas av en Admin eller Administratör innan den bekräftas.',
    useCase: 'Standardroll för alla nya anställda. Alla nya konton börjar här.',
  },
}

function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <span className={cn('badge badge-status', className)} style={{ '--badge-color': ROLE_CONFIG[role].color } as CSSProperties}>
      {ROLE_CONFIG[role].label}
    </span>
  )
}

const MENU_HEIGHT_PX = 132 // 3 items — used to decide whether to open upward

/*
  The menu is rendered in a portal on <body>, positioned from the button's
  screen rect. Rendering it inline meant the list card's overflow-hidden clipped
  it for the bottom rows.
*/
function RoleDropdown({ current, onChange, disabled }: {
  current: UserRole
  onChange: (role: UserRole) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)

  function toggle() {
    if (disabled) return
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const right = window.innerWidth - r.right
    const fitsBelow = r.bottom + 6 + MENU_HEIGHT_PX <= window.innerHeight
    setPos(fitsBelow
      ? { top: r.bottom + 6, right }
      : { bottom: window.innerHeight - r.top + 6, right })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('badge badge-status transition-all', disabled ? 'cursor-default opacity-70' : 'hover:brightness-115 cursor-pointer')}
        style={{ '--badge-color': ROLE_CONFIG[current].color } as CSSProperties}
      >
        {ROLE_CONFIG[current].label}
        {!disabled && <ChevronDown className="h-3 w-3 -mr-0.5" />}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="menu fixed z-50 min-w-40 animate-scale-in" style={pos}>
            {(Object.keys(ROLE_CONFIG) as UserRole[]).map(role => (
              <button
                key={role}
                role="menuitem"
                onClick={() => { onChange(role); setOpen(false) }}
                className={cn('menu-item', role === current && 'bg-secondary/60 text-foreground')}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: ROLE_CONFIG[role].color }} />
                {ROLE_CONFIG[role].label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

function RoleDelegationGuide() {
  const [open, setOpen] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <Info className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium flex-1">Vad innebär varje roll?</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border/60">
          {(Object.keys(ROLE_DESCRIPTIONS) as UserRole[]).map(role => {
            const desc = ROLE_DESCRIPTIONS[role]
            return (
              <div key={role} className="px-4 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: ROLE_CONFIG[role].color }} />
                  <p className="text-sm font-semibold" style={{ color: ROLE_CONFIG[role].color }}>{desc.title}</p>
                </div>
                <p className="text-sm text-foreground/90 pl-4">{desc.description}</p>
                <p className="text-xs text-muted-foreground pl-4 italic">{desc.useCase}</p>
                <div className="flex flex-wrap gap-1.5 pl-4 pt-1">
                  {ROLE_PERMISSIONS[role].map(perm => (
                    <span key={perm} className="badge badge-sm badge-outline font-medium">{perm}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WorkerRow({ worker, locked, onRoleChange, onToggleActive }: {
  worker: Profile
  locked: boolean
  onRoleChange: (id: string, role: UserRole) => void
  onToggleActive: (id: string, active: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)

  async function patch(body: { role?: UserRole; is_active?: boolean }, onOk: () => void, errTitle: string) {
    setSaving(true)
    const res = await fetch(`/api/workers/${worker.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      onOk()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(errTitle, { description: d.error ?? `${res.status} ${res.statusText}` })
    }
    setSaving(false)
  }

  return (
    <li className={cn('border-b border-border last:border-0 transition-colors', !worker.is_active && 'opacity-50')}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="avatar">{worker.full_name?.charAt(0) ?? '?'}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {worker.full_name}
            {locked && <span className="ml-2 text-[11px] text-muted-foreground font-normal">(du)</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">{worker.email}</p>
        </div>
        <span className="text-xs text-muted-foreground tabular hidden sm:block w-28 shrink-0">
          {worker.phone ?? '—'}
        </span>
        <div onClick={e => e.stopPropagation()} className="w-32 flex justify-end">
          <RoleDropdown
            current={worker.role}
            onChange={role => patch({ role }, () => { onRoleChange(worker.id, role); toast.success('Rollen uppdaterades') }, 'Kunde inte ändra roll')}
            disabled={saving || locked}
          />
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            const next = !worker.is_active
            void patch({ is_active: next }, () => { onToggleActive(worker.id, next); toast.success(next ? 'Anställd aktiverad' : 'Anställd avaktiverad') }, 'Kunde inte ändra status')
          }}
          disabled={saving || locked}
          title={worker.is_active ? 'Avaktivera' : 'Aktivera'}
          aria-label={worker.is_active ? 'Avaktivera' : 'Aktivera'}
          className={cn(
            'btn btn-ghost btn-icon btn-sm',
            worker.is_active ? 'text-status-completed hover:text-destructive hover:bg-destructive/10' : 'hover:text-status-completed hover:bg-status-completed/10'
          )}
        >
          {saving ? <Loader2 className="animate-spin" /> : worker.is_active ? <UserCheck /> : <UserX />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-secondary/20 border-t border-border/60">
          <p className="label-caps mb-2">Behörigheter — {ROLE_CONFIG[worker.role].label}</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_PERMISSIONS[worker.role].map(perm => (
              <span key={perm} className="badge badge-sm badge-outline font-medium">{perm}</span>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

function AddWorkerForm({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (w: Profile) => void }) {
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [role, setRole]           = useState<UserRole>('worker')

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      setFormError('Namn och e-post krävs')
      return
    }
    setSaving(true)
    setFormError(null)
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, phone, role }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = data.error ?? `${res.status} ${res.statusText}`
      setFormError(message)
      toast.error('Kunde inte lägga till anställd', { description: message })
      setSaving(false)
      return
    }
    onAdded(data as Profile)
    toast.success('Anställd tillagd', { description: 'En inbjudan har skickats via e-post' })
    setFullName(''); setEmail(''); setPhone(''); setRole('worker')
    setSaving(false)
    onClose()
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} className="card p-4 space-y-4 animate-scale-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Ny anställd</p>
          <p className="text-xs text-muted-foreground mt-0.5">Personen får ett e-postmeddelande för att välja lösenord</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Stäng" className="btn btn-ghost btn-icon btn-sm">
          <X />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label-caps block" htmlFor="nw-name">Namn *</label>
          <input id="nw-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="För- och efternamn" className="field" />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps block" htmlFor="nw-email">E-post *</label>
          <input id="nw-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="namn@exempel.se" className="field" />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps block" htmlFor="nw-phone">Telefon</label>
          <input id="nw-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07X-XXX XX XX" className="field" />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps block" htmlFor="nw-role">Roll</label>
          <select id="nw-role" value={role} onChange={e => setRole(e.target.value as UserRole)} className="field">
            {(Object.keys(ROLE_CONFIG) as UserRole[]).filter(r => r !== 'admin').map(r => (
              <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
            ))}
          </select>
        </div>
      </div>

      {formError && (
        <p className="text-xs text-destructive bg-destructive/12 border border-destructive/30 px-3 py-2 rounded-md">{formError}</p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Avbryt</button>
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Lägg till
        </button>
      </div>
    </form>
  )
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Profile[]>([])
  const [myId, setMyId]       = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    (async () => {
      // ?all=true includes inactive employees so they can be reactivated
      const [res, meRes] = await Promise.all([fetch('/api/workers?all=true'), fetch('/api/me')])
      if (meRes.ok) setMyId(((await meRes.json()) as { id: string }).id)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        const message = d.error ?? `${res.status} ${res.statusText}`
        setError(message)
        toast.error('Kunde inte hämta personal', { description: message })
        setLoading(false)
        return
      }
      setWorkers(await res.json())
      setLoading(false)
    })()
  }, [])

  const sorted = [...workers].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return a.full_name.localeCompare(b.full_name, 'sv')
  })

  const activeCount = workers.filter(w => w.is_active).length

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="Personal"
        subtitle={loading ? 'Laddar…' : `${activeCount} aktiva · ${workers.length - activeCount} inaktiva`}
        actions={
          !adding && (
            <button onClick={() => setAdding(true)} className="btn btn-primary btn-sm">
              <Plus />
              Lägg till anställd
            </button>
          )
        }
      />

      <AddWorkerForm open={adding} onClose={() => setAdding(false)} onAdded={w => setWorkers(prev => [...prev, w])} />

      <RoleDelegationGuide />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar personal…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive bg-destructive/12 px-4 py-3 rounded-md border border-destructive/30">{error}</p>
      ) : sorted.length === 0 ? (
        <div className="card empty">
          <Users />
          <p className="empty-title">Ingen personal hittades</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
            <div className="w-8 shrink-0" />
            <span className="label-caps flex-1">Namn</span>
            <span className="label-caps hidden sm:block w-28 shrink-0">Telefon</span>
            <span className="label-caps w-32 shrink-0 text-right">Roll</span>
            <span className="w-8 shrink-0" />
          </div>
          <ul>
            {sorted.map(w => (
              <WorkerRow
                key={w.id}
                worker={w}
                locked={w.id === myId}
                onRoleChange={(id, role) => setWorkers(prev => prev.map(x => x.id === id ? { ...x, role } : x))}
                onToggleActive={(id, active) => setWorkers(prev => prev.map(x => x.id === id ? { ...x, is_active: active } : x))}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(Object.keys(ROLE_CONFIG) as UserRole[]).map(role => (
          <div key={role} className="flex items-center gap-2 text-xs text-muted-foreground">
            <RoleBadge role={role} className="badge-sm" />
            <span>{ROLE_PERMISSIONS[role].length} behörigheter</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Klicka på en rad för att se behörigheter. Ändra roll direkt i listan. Ditt eget konto kan inte ändras härifrån, och den sista aktiva administratören kan inte tas bort.
      </p>
    </div>
  )
}
