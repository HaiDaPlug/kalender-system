'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Booking, BookingStatus, Profile } from '@/types'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { CreateBookingModal } from './create-booking-modal'
import { cn } from '@/lib/utils/cn'
import type { CalendarView } from './calendar-utils'
import {
  STATUS_CONFIG,
  MONTHS_SE,
  addDays,
  startOfWeek,
  isSameDay,
  getWeekNumber,
} from './calendar-utils'
import { MonthView } from './month-view'
import { WeekView } from './week-view'
import { DayView } from './day-view'
import { BookingDetailPanel } from './booking-detail-panel'

interface Props {
  bookings: Booking[]
  workers?: Profile[]
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'dag', label: 'Dag' },
  { key: 'vecka', label: 'Vecka' },
  { key: 'månad', label: 'Månad' },
]

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as BookingStatus[]

export function CalendarView({ bookings, workers = [] }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openedViaLink = searchParams.get('new') === '1'

  const [view, setView] = useState<CalendarView>('vecka')
  const [current, setCurrent] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [workerFilter, setWorkerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(openedViaLink)
  const [createModalTime, setCreateModalTime] = useState<Date>(new Date())

  // Refresh server data without losing client state (view, filters, scroll position)
  const handleBookingCreated = useCallback(() => {
    router.refresh()
  }, [router])

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false)
    // Drop ?new=1 so a reload doesn't reopen the modal.
    if (openedViaLink) router.replace('/calendar')
  }, [openedViaLink, router])

  // Navigation
  const navigate = useCallback((dir: -1 | 1) => {
    setCurrent(prev => {
      if (view === 'dag') return addDays(prev, dir)
      if (view === 'vecka') return addDays(prev, dir * 7)
      return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
    })
  }, [view])

  // Keyboard: ← / → to move, T for today. Ignored while typing or when a dialog is open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showCreateModal || selectedBooking || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1) }
      else if (e.key === 't' || e.key === 'T') setCurrent(new Date())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, showCreateModal, selectedBooking])

  // Header title + a quieter range/date hint next to it
  const { title, hint } = useMemo(() => {
    const today = new Date()
    if (view === 'dag') {
      const isToday = isSameDay(current, today)
      return {
        title: isToday ? 'Idag' : `${current.getDate()} ${MONTHS_SE[current.getMonth()]} ${current.getFullYear()}`,
        hint: isToday ? `${current.getDate()} ${MONTHS_SE[current.getMonth()]} ${current.getFullYear()}` : null,
      }
    }
    if (view === 'vecka') {
      const ws = startOfWeek(current)
      const we = addDays(ws, 6)
      const sameMonth = ws.getMonth() === we.getMonth()
      const title = sameMonth
        ? `${MONTHS_SE[ws.getMonth()]} ${ws.getFullYear()}`
        : `${MONTHS_SE[ws.getMonth()].slice(0, 3)}–${MONTHS_SE[we.getMonth()].slice(0, 3)} ${ws.getFullYear()}`
      const range = sameMonth
        ? `${ws.getDate()}–${we.getDate()} ${MONTHS_SE[ws.getMonth()].slice(0, 3).toLowerCase()}`
        : `${ws.getDate()} ${MONTHS_SE[ws.getMonth()].slice(0, 3).toLowerCase()} – ${we.getDate()} ${MONTHS_SE[we.getMonth()].slice(0, 3).toLowerCase()}`
      return { title, hint: `V${getWeekNumber(current)} · ${range}` }
    }
    return { title: `${MONTHS_SE[current.getMonth()]} ${current.getFullYear()}`, hint: null }
  }, [view, current])

  // Worker filter applies first; the status chips count within that set so the
  // numbers always add up to what "Alla" shows.
  const byWorker = useMemo(
    () => workerFilter === 'all' ? bookings : bookings.filter(b => b.assigned_worker_id === workerFilter),
    [bookings, workerFilter],
  )
  const filtered = useMemo(
    () => statusFilter === 'all' ? byWorker : byWorker.filter(b => b.status === statusFilter),
    [byWorker, statusFilter],
  )
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(ALL_STATUSES.map(s => [s, 0])) as Record<BookingStatus, number>
    for (const b of byWorker) counts[b.status] = (counts[b.status] ?? 0) + 1
    return counts
  }, [byWorker])
  const visibleTotal = byWorker.length

  const handleSelectDay = (day: Date) => {
    setCurrent(day)
    setView('dag')
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 bg-background overflow-hidden">
      {/* Toolbar — navigation + title on the left, "Ny bokning" always top right */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => navigate(-1)} aria-label="Föregående" title="Föregående (←)" className="btn btn-ghost btn-icon btn-sm">
            <ChevronLeft />
          </button>
          <button onClick={() => navigate(1)} aria-label="Nästa" title="Nästa (→)" className="btn btn-ghost btn-icon btn-sm">
            <ChevronRight />
          </button>
        </div>

        <div className="flex items-baseline gap-2.5 min-w-0">
          <span className="text-[1.05rem] font-semibold tracking-tight truncate">{title}</span>
          {hint && <span className="label-caps hidden sm:inline truncate">{hint}</span>}
        </div>

        <button
          onClick={() => { setCreateModalTime(new Date()); setShowCreateModal(true) }}
          className="btn btn-primary btn-sm ml-auto shrink-0"
        >
          <Plus />
          Ny bokning
        </button>
      </div>

      {/* Calendar body */}
      <div className="flex flex-col flex-1 min-h-0 relative">
        {view === 'månad' && (
          <MonthView
            current={current}
            bookings={filtered}
            onSelectBooking={setSelectedBooking}
            onSelectDay={handleSelectDay}
          />
        )}
        {view === 'vecka' && (
          <WeekView
            current={current}
            bookings={filtered}
            workers={workers}
            onSelectBooking={setSelectedBooking}
            onBookingCreated={handleBookingCreated}
          />
        )}
        {view === 'dag' && (
          <DayView
            current={current}
            bookings={filtered}
            workers={workers}
            onSelectBooking={setSelectedBooking}
            onBookingCreated={handleBookingCreated}
          />
        )}

        {/* Detail panel */}
        <BookingDetailPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      </div>

      {/* Bottom bar — view + worker controls on the left, status filter chips on the right */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-border shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={view}
            onChange={e => setView(e.target.value as CalendarView)}
            aria-label="Vy"
            className="field field-sm w-auto"
          >
            {VIEWS.map(v => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>

          {workers.length > 0 && (
            <select
              value={workerFilter}
              onChange={e => setWorkerFilter(e.target.value)}
              aria-label="Ansvarig"
              className="field field-sm w-auto max-w-[12rem]"
            >
              <option value="all">Alla ansvariga</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.full_name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'flex items-center gap-1.5 shrink-0 h-7 px-2.5 rounded-md transition-all border border-transparent',
              statusFilter === 'all' ? 'bg-secondary border-border' : 'opacity-60 hover:opacity-100'
            )}
          >
            <span className="label-caps">Alla</span>
            <span className="label-caps tabular text-foreground">{visibleTotal}</span>
          </button>
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s]
            const count = statusCounts[s]
            const active = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? 'all' : s)}
                title={active ? 'Visa alla statusar' : `Visa bara ${cfg.label.toLowerCase()}`}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 h-7 px-2.5 rounded-md transition-all border border-transparent',
                  statusFilter !== 'all' && !active && 'opacity-35',
                  active && 'bg-secondary border-border'
                )}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.border}` }} />
                <span className="label-caps">{cfg.label}</span>
                <span className="label-caps tabular text-foreground">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal for a new booking via the toolbar button / ?new=1 link */}
      <CreateBookingModal
        key={createModalTime.toISOString()}
        open={showCreateModal}
        initialDate={createModalTime}
        workers={workers}
        onClose={closeCreateModal}
        onCreated={handleBookingCreated}
      />
    </div>
  )
}
