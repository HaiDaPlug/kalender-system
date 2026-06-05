'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react'
import type { Shift, Booking, Profile } from '@/types'
import { CreateShiftModal } from '@/components/shifts/create-shift-modal'

// Dev-stub: ersätt med riktig session när auth aktiveras
const DEV_USER: Profile = {
  id:         '00000000-0000-0000-0000-000000000001',
  email:      'dev@komfort.se',
  full_name:  'Dev Användare',
  role:       'worker',
  is_active:  true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: 'Väntar',     color: 'text-amber-400',  icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: 'Godkänt',   color: 'text-green-400',  icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: 'Avvisat',   color: 'text-red-400',    icon: <XCircle className="h-3.5 w-3.5" /> },
}

function formatShiftTime(shift: Shift): { date: string; time: string; hours: number } {
  const start   = new Date(shift.starts_at)
  const end     = new Date(shift.ends_at)
  const date    = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
  const s       = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const e       = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const hours   = Math.round((end.getTime() - start.getTime()) / 36e5 * 10) / 10
  return { date, time: `${s}–${e}`, hours }
}

export default function MyShiftsPage() {
  const currentUser = DEV_USER

  const [shifts, setShifts]           = useState<Shift[]>([])
  const [bookings, setBookings]       = useState<Booking[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [showCreate, setShowCreate]   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [shiftsRes, bookingsRes] = await Promise.all([
      fetch(`/api/shifts?worker_id=${currentUser.id}`),
      fetch(`/api/bookings?worker_id=${currentUser.id}`),
    ])
    const [shiftsData, bookingsData] = await Promise.all([
      shiftsRes.json(),
      bookingsRes.json(),
    ])
    setShifts(Array.isArray(shiftsData) ? shiftsData : [])
    setBookings(Array.isArray(bookingsData) ? bookingsData : [])
    setLoading(false)
  }, [currentUser.id])

  useEffect(() => { (async () => { await fetchData() })() }, [fetchData])

  // Filtrera pass på sökning och status
  const filtered = shifts.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search) {
      const q   = search.toLowerCase()
      const fmt = formatShiftTime(s)
      return fmt.date.toLowerCase().includes(q) || (s.notes ?? '').toLowerCase().includes(q)
    }
    return true
  })

  // Hämta bokningar som faller inom ett pass
  function bookingsForShift(shift: Shift): Booking[] {
    const start = new Date(shift.starts_at)
    const end   = new Date(shift.ends_at)
    return bookings.filter(b => {
      const bt = new Date(b.scheduled_at)
      return bt >= start && bt <= end
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-base font-semibold">Mina pass</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Lägg in pass
        </button>
      </div>

      {/* Sök + filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Sök pass…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Alla status</option>
          <option value="pending">Väntar</option>
          <option value="approved">Godkänt</option>
          <option value="rejected">Avvisat</option>
        </select>
      </div>

      {/* Passlista */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Inga pass hittade.</p>
        )}
        {!loading && filtered.map(shift => {
          const fmt      = formatShiftTime(shift)
          const cfg      = STATUS_LABEL[shift.status]
          const shiftBkgs = bookingsForShift(shift)

          return (
            <div key={shift.id} className="rounded border border-border bg-card overflow-hidden">
              {/* Pass-header */}
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">{fmt.date}</p>
                  <p className="text-xs text-muted-foreground">{fmt.time} · {fmt.hours} tim</p>
                  {shift.notes && (
                    <p className="text-xs mt-1.5 px-2 py-1 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                      {shift.notes}
                    </p>
                  )}
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${cfg.color} shrink-0`}>
                  {cfg.icon}
                  {cfg.label}
                </div>
              </div>

              {/* Kopplade bokningar */}
              {shiftBkgs.length > 0 && (
                <div className="border-t border-border divide-y divide-border/50">
                  <p className="px-4 py-1.5 label-caps text-muted-foreground">
                    {shiftBkgs.length} {shiftBkgs.length === 1 ? 'bokning' : 'bokningar'} under passet
                  </p>
                  {shiftBkgs.map(b => (
                    <div key={b.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.customer?.full_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(b.scheduled_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{b.service_type}
                          {b.car && ` · ${b.car.make} ${b.car.model}`}
                          {b.car?.license_plate && ` (${b.car.license_plate})`}
                        </p>
                        {/* Kommentarer/önskemål syns tydligt */}
                        {b.customer_notes && (
                          <p className="text-xs mt-1 px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {b.customer_notes}
                          </p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground shrink-0">
                        {b.status === 'confirmed'   ? 'Bekräftad'  :
                         b.status === 'pending'     ? 'Väntar'     :
                         b.status === 'in_progress' ? 'Pågår'      :
                         b.status === 'completed'   ? 'Klar'       : b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <CreateShiftModal
        open={showCreate}
        initialDate={new Date()}
        currentUser={currentUser}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchData() }}
      />
    </div>
  )
}
