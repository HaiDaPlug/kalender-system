'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus, CalendarClock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Shift, Booking } from '@/types'
import { CreateShiftModal, type ShiftUser } from '@/components/shifts/create-shift-modal'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

function formatShiftTime(shift: Shift): { date: string; time: string; hours: number } {
  const start = new Date(shift.starts_at)
  const end   = new Date(shift.ends_at)
  const date  = start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
  const s     = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const e     = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const hours = Math.round((end.getTime() - start.getTime()) / 36e5 * 10) / 10
  return { date, time: `${s}–${e}`, hours }
}

export function MyShiftsView({ currentUser }: { currentUser: ShiftUser }) {
  const [shifts, setShifts]             = useState<Shift[]>([])
  const [bookings, setBookings]         = useState<Booking[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showCreate, setShowCreate]     = useState(false)

  // `loading` starts true and is only cleared here; refetches refresh in place.
  const fetchData = useCallback(async () => {
    try {
      const [shiftsRes, bookingsRes] = await Promise.all([
        fetch(`/api/shifts?worker_id=${currentUser.id}`),
        fetch(`/api/bookings?worker_id=${currentUser.id}`),
      ])
      if (!shiftsRes.ok) {
        const d = await shiftsRes.json().catch(() => ({}))
        toast.error('Kunde inte hämta pass', { description: d.error ?? `${shiftsRes.status} ${shiftsRes.statusText}` })
      }
      const [shiftsData, bookingsData] = await Promise.all([
        shiftsRes.ok ? shiftsRes.json() : [],
        bookingsRes.ok ? bookingsRes.json() : [],
      ])
      setShifts(Array.isArray(shiftsData) ? shiftsData : [])
      setBookings(Array.isArray(bookingsData) ? bookingsData : [])
    } catch (err) {
      toast.error('Kunde inte hämta pass', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    } finally {
      setLoading(false)
    }
  }, [currentUser.id])

  useEffect(() => { (async () => { await fetchData() })() }, [fetchData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return shifts
      .filter(s => statusFilter === 'all' || s.status === statusFilter)
      .filter(s => {
        if (!q) return true
        const fmt = formatShiftTime(s)
        return fmt.date.toLowerCase().includes(q) || (s.notes ?? '').toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
  }, [shifts, search, statusFilter])

  const approvedHours = useMemo(
    () => shifts.filter(s => s.status === 'approved').reduce((sum, s) => sum + formatShiftTime(s).hours, 0),
    [shifts],
  )
  const pendingCount = shifts.filter(s => s.status === 'pending').length

  function bookingsForShift(shift: Shift): Booking[] {
    const start = new Date(shift.starts_at)
    const end   = new Date(shift.ends_at)
    return bookings.filter(b => {
      const bt = new Date(b.scheduled_at)
      return bt >= start && bt <= end
    })
  }

  return (
    <div className="flex flex-col gap-4 h-full max-w-2xl mx-auto w-full">
      <PageHeader
        title="Mina pass"
        subtitle={
          loading
            ? 'Laddar…'
            : `${shifts.length} pass · ${Math.round(approvedHours * 10) / 10} godkända timmar${pendingCount ? ` · ${pendingCount} väntar` : ''}`
        }
        actions={
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
            <Plus />
            Lägg in pass
          </button>
        }
      />

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="field-icon flex-1 min-w-40">
          <Search />
          <input
            placeholder="Sök pass…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="field w-auto"
        >
          <option value="all">Alla status</option>
          <option value="pending">Väntar</option>
          <option value="approved">Godkänt</option>
          <option value="rejected">Avvisat</option>
        </select>
      </div>

      {/* Shift list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-6">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Laddar pass…</span>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="card empty">
            <CalendarClock />
            <p className="empty-title">{shifts.length === 0 ? 'Inga pass inlagda ännu' : 'Inga pass matchar'}</p>
            <p className="empty-text">
              {shifts.length === 0 ? 'Lägg in ditt första pass så det kan godkännas.' : 'Prova en annan sökning eller ett annat filter.'}
            </p>
          </div>
        )}
        {!loading && filtered.map(shift => {
          const fmt       = formatShiftTime(shift)
          const shiftBkgs = bookingsForShift(shift)

          return (
            <div key={shift.id} className="card overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">{fmt.date}</p>
                  <p className="text-xs text-muted-foreground tabular mt-0.5">{fmt.time} · {fmt.hours} tim</p>
                  {shift.notes && (
                    <p className="text-xs mt-2 px-2.5 py-1.5 rounded-md bg-status-pending/10 text-status-pending border border-status-pending/25">
                      {shift.notes}
                    </p>
                  )}
                </div>
                <StatusBadge status={shift.status} kind="shift" size="sm" className="shrink-0" />
              </div>

              {shiftBkgs.length > 0 && (
                <div className="border-t border-border divide-y divide-border/60 bg-secondary/20">
                  <p className="px-4 py-1.5 label-caps">
                    {shiftBkgs.length} {shiftBkgs.length === 1 ? 'bokning' : 'bokningar'} under passet
                  </p>
                  {shiftBkgs.map(b => (
                    <Link key={b.id} href={`/bookings/${b.id}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.customer?.full_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(b.scheduled_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{b.service_type}
                          {b.car && ` · ${b.car.make} ${b.car.model}`}
                          {b.car?.license_plate && <span className="plate ml-1.5 text-primary/90">{b.car.license_plate}</span>}
                        </p>
                        {b.customer_notes && (
                          <p className="text-xs mt-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/25">
                            {b.customer_notes}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={b.status} size="sm" className="shrink-0" />
                    </Link>
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
        onCreated={() => { setShowCreate(false); void fetchData() }}
      />
    </div>
  )
}
