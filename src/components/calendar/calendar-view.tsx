'use client'

import { useState, useMemo } from 'react'
import type { Booking, BookingStatus, Profile } from '@/types'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { CalendarView } from './calendar-utils'
import {
  STATUS_CONFIG,
  MONTHS_SE,
  addDays,
  startOfWeek,
  getWeekNumber,
  isSameDay,
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
  const [view, setView] = useState<CalendarView>('vecka')
  const [current, setCurrent] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [workerFilter, setWorkerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')

  // Navigation
  const navigate = (dir: -1 | 1) => {
    setCurrent(prev => {
      if (view === 'dag') return addDays(prev, dir)
      if (view === 'vecka') return addDays(prev, dir * 7)
      return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
    })
  }

  const goToday = () => setCurrent(new Date())

  // Header title
  const title = useMemo(() => {
    if (view === 'dag') {
      const today = new Date()
      if (isSameDay(current, today)) return 'Idag'
      return `${current.getDate()} ${MONTHS_SE[current.getMonth()]} ${current.getFullYear()}`
    }
    if (view === 'vecka') {
      const ws = startOfWeek(current)
      const we = addDays(ws, 6)
      const wn = getWeekNumber(current)
      if (ws.getMonth() === we.getMonth()) {
        return `Vecka ${wn} · ${MONTHS_SE[ws.getMonth()]} ${ws.getFullYear()}`
      }
      return `Vecka ${wn} · ${MONTHS_SE[ws.getMonth()].slice(0, 3)}–${MONTHS_SE[we.getMonth()].slice(0, 3)} ${ws.getFullYear()}`
    }
    return `${MONTHS_SE[current.getMonth()]} ${current.getFullYear()}`
  }, [view, current])

  // Filtered bookings
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      if (workerFilter !== 'all' && b.assigned_worker_id !== workerFilter) return false
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      return true
    })
  }, [bookings, workerFilter, statusFilter])

  const handleSelectDay = (day: Date) => {
    setCurrent(day)
    setView('dag')
  }

  return (
    <div className="relative flex flex-col h-full rounded border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 flex-wrap gap-y-2">
        {/* Today button */}
        <button
          onClick={goToday}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border text-xs font-medium hover:bg-secondary transition-colors"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Idag
        </button>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate(1)}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Title */}
        <span className="text-sm font-semibold">{title}</span>

        <div className="flex-1" />

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as BookingStatus | 'all')}
          className="h-7 text-xs rounded border border-border bg-secondary text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Alla statusar</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {/* Worker filter */}
        {workers.length > 0 && (
          <select
            value={workerFilter}
            onChange={e => setWorkerFilter(e.target.value)}
            className="h-7 text-xs rounded border border-border bg-secondary text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Alla tekniker</option>
            {workers.map(w => (
              <option key={w.id} value={w.id}>{w.full_name}</option>
            ))}
          </select>
        )}

        {/* View switcher */}
        <div className="flex rounded border border-border overflow-hidden">
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                'px-3 py-1 text-xs font-medium transition-colors',
                view === v.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
        {ALL_STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s]
          const count = filtered.filter(b => b.status === s).length
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={cn(
                'flex items-center gap-1.5 shrink-0 transition-opacity',
                statusFilter !== 'all' && statusFilter !== s && 'opacity-30'
              )}
            >
              <div className="h-2 w-2 rounded-full" style={{ background: cfg.color }} />
              <span className="label-caps">{cfg.label}</span>
              <span className="label-caps tabular text-foreground">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Calendar body */}
      <div className="flex-1 min-h-0 relative">
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
            onSelectBooking={setSelectedBooking}
          />
        )}
        {view === 'dag' && (
          <DayView
            current={current}
            bookings={filtered}
            onSelectBooking={setSelectedBooking}
          />
        )}

        {/* Detail panel */}
        {selectedBooking && (
          <BookingDetailPanel
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
          />
        )}
      </div>
    </div>
  )
}
