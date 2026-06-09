'use client'

import { useState, useEffect } from 'react'
import { Loader2, UserCheck, UserX, ChevronDown, Plus, X } from 'lucide-react'
import type { Profile, UserRole } from '@/types'
import { cn } from '@/lib/utils/cn'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string }> = {
  admin:   { label: 'Administratör', color: '#F5C842', bg: '#F5C84218' },
  manager: { label: 'Chef',          color: '#4A90D9', bg: '#4A90D918' },
  worker:  { label: 'Tekniker',      color: '#8B5CF6', bg: '#8B5CF618' },
}

// Permissions per role — matches actual enforcement in the codebase
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin:   ['Se kalender', 'Skapa bokningar', 'Redigera bokningar', 'Ta bort bokningar', 'Hantera personal', 'Granska jobb'],
  manager: ['Se kalender', 'Granska jobb'],
  worker:  ['Se kalender', 'Ladda upp jobbfoton', 'Hantera egna pass'],
}

function RoleDropdown({ current, onChange, disabled }: {
  current: UserRole
  onChange: (role: UserRole) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const cfg = ROLE_CONFIG[current]

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
          disabled ? 'cursor-default opacity-60' : 'hover:opacity-80 cursor-pointer'
        )}
        style={{ color: cfg.color, background: cfg.bg }}
      >
        {cfg.label}
        {!disabled && <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded shadow-lg overflow-hidden min-w-36">
            {(Object.keys(ROLE_CONFIG) as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => { onChange(role); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-secondary transition-colors',
                  role === current && 'bg-secondary/60'
                )}
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: ROLE_CONFIG[role].color }} />
                {ROLE_CONFIG[role].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function WorkerRow({ worker, onRoleChange, onToggleActive }: {
  worker: Profile
  onRoleChange: (id: string, role: UserRole) => void
  onToggleActive: (id: string, active: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleRoleChange(role: UserRole) {
    setSaving(true)
    const res = await fetch(`/api/workers/${worker.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) onRoleChange(worker.id, role)
    setSaving(false)
  }

  async function handleToggleActive() {
    setSaving(true)
    const res = await fetch(`/api/workers/${worker.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !worker.is_active }),
    })
    if (res.ok) onToggleActive(worker.id, !worker.is_active)
    setSaving(false)
  }

  return (
    <li className={cn('border-b border-border last:border-0 transition-colors', !worker.is_active && 'opacity-50')}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {worker.full_name?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{worker.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{worker.email}</p>
        </div>
        <span className="text-xs text-muted-foreground tabular hidden sm:block w-28 shrink-0">
          {worker.phone ?? '—'}
        </span>
        <div onClick={e => e.stopPropagation()}>
          <RoleDropdown
            current={worker.role}
            onChange={handleRoleChange}
            disabled={saving || worker.role === 'admin'}
          />
        </div>
        <button
          onClick={e => { e.stopPropagation(); void handleToggleActive() }}
          disabled={saving || worker.role === 'admin'}
          title={worker.is_active ? 'Avaktivera' : 'Aktivera'}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded transition-colors shrink-0',
            worker.is_active
              ? 'text-green-400 hover:bg-red-500/10 hover:text-red-400'
              : 'text-muted-foreground hover:bg-green-500/10 hover:text-green-400',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : worker.is_active
            ? <UserCheck className="h-3.5 w-3.5" />
            : <UserX className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Expanded: show permissions for this role */}
      {expanded && (
        <div className="px-5 pb-4 pt-2 bg-secondary/10 border-t border-border/50">
          <p className="label-caps text-muted-foreground mb-2">
            Behörigheter — {ROLE_CONFIG[worker.role].label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_PERMISSIONS[worker.role].map(perm => (
              <span
                key={perm}
                className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground"
              >
                {perm}
              </span>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

function AddWorkerForm({ onAdded }: { onAdded: (w: Profile) => void }) {
  const [open, setOpen]         = useState(false)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [role, setRole]         = useState<UserRole>('worker')

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
    const data = await res.json()
    if (!res.ok) { setFormError(data.error ?? 'Kunde inte lägga till'); setSaving(false); return }
    onAdded(data as Profile)
    setFullName(''); setEmail(''); setPhone(''); setRole('worker')
    setOpen(false)
    setSaving(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
      >
        <Plus className="h-3.5 w-3.5" />
        Lägg till anställd
      </button>
    )
  }

  return (
    <form
      onSubmit={e => void handleSubmit(e)}
      className="rounded border border-border bg-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Ny anställd</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="label-caps text-muted-foreground">Namn *</label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="För- och efternamn"
            className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-1">
          <label className="label-caps text-muted-foreground">E-post *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="namn@exempel.se"
            className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-1">
          <label className="label-caps text-muted-foreground">Telefon</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="07X-XXX XX XX"
            className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-1">
          <label className="label-caps text-muted-foreground">Roll</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {(Object.keys(ROLE_CONFIG) as UserRole[]).filter(r => r !== 'admin').map(r => (
              <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
            ))}
          </select>
        </div>
      </div>

      {formError && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{formError}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-xs rounded border border-border hover:bg-secondary transition-colors"
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Lägg till
        </button>
      </div>
    </form>
  )
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // ?all=true includes inactive employees so they can be reactivated
      const res = await fetch('/api/workers?all=true')
      if (!res.ok) { setError('Kunde inte hämta personal'); setLoading(false); return }
      setWorkers(await res.json())
      setLoading(false)
    }
    void load()
  }, [])

  function handleRoleChange(id: string, role: UserRole) {
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, role } : w))
  }

  function handleToggleActive(id: string, active: boolean) {
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, is_active: active } : w))
  }

  function handleAdded(worker: Profile) {
    setWorkers(prev => [...prev, worker])
  }

  // Active employees first, then alphabetically
  const sorted = [...workers].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return a.full_name.localeCompare(b.full_name, 'sv')
  })

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Personal</h1>
          <p className="text-muted-foreground text-sm">Hantera roller och behörigheter för ditt team</p>
        </div>
      </div>

      {/* Add employee form */}
      <AddWorkerForm onAdded={handleAdded} />

      {/* Role legend */}
      <div className="flex gap-4 flex-wrap">
        {(Object.keys(ROLE_CONFIG) as UserRole[]).map(role => (
          <div key={role} className="flex items-center gap-1.5 text-xs">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: ROLE_CONFIG[role].color }} />
            <span style={{ color: ROLE_CONFIG[role].color }}>{ROLE_CONFIG[role].label}</span>
            <span className="text-muted-foreground">— {ROLE_PERMISSIONS[role].length} behörigheter</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar personal…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 bg-red-500/10 px-4 py-3 rounded border border-red-500/20">{error}</p>
      ) : sorted.length === 0 ? (
        <div className="rounded border border-border bg-card px-5 py-14 text-center">
          <p className="text-sm text-muted-foreground">Ingen personal hittades</p>
        </div>
      ) : (
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border">
            <div className="w-8 shrink-0" />
            <span className="label-caps flex-1">Namn</span>
            <span className="label-caps hidden sm:block w-28 shrink-0">Telefon</span>
            <span className="label-caps w-28 shrink-0 text-right mr-7">Roll</span>
          </div>
          <ul>
            {sorted.map(w => (
              <WorkerRow
                key={w.id}
                worker={w}
                onRoleChange={handleRoleChange}
                onToggleActive={handleToggleActive}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Klicka på en rad för att se behörigheter. Ändra roll direkt i listan — administratörens roll kan inte ändras härifrån.
      </p>
    </div>
  )
}
