'use client'

import type { Booking } from '@/types'
import {
  format,
  startOfMonth, endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfWeek, endOfWeek,
  isToday as dateFnsIsToday,
} from 'date-fns'
import { sv } from 'date-fns/locale'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  pending:     '#C4962A',
  confirmed:   '#4A90D9',
  in_progress: '#8B5CF6',
  completed:   '#3DAB6A',
  cancelled:   '#E05252',
}

const DAYS_SE = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export function CalendarView({ bookings }: { bookings: Booking[] }) {
  const [current, setCurrent] = useState(new Date())

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const prev = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const next = () => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold capitalize">
            {format(current, 'MMMM', { locale: sv })}
          </span>
          <span className="label-caps">{format(current, 'yyyy')}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={prev}
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={next}
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS_SE.map(d => (
          <div key={d} className="py-2 text-center label-caps">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dayBookings = bookings.filter(b => isSameDay(new Date(b.scheduled_at), day))
          const isCurrentMonth = day.getMonth() === current.getMonth()
          const isToday = dateFnsIsToday(day)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[88px] p-2 border-b border-r border-border transition-colors',
                !isCurrentMonth && 'opacity-25',
                isToday && 'bg-primary/5',
                'hover:bg-secondary/30 cursor-default'
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded text-xs tabular font-medium',
                  isToday
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground'
                )}
              >
                {format(day, 'd')}
              </span>

              <div className="mt-1 space-y-0.5">
                {dayBookings.slice(0, 3).map(b => (
                  <div
                    key={b.id}
                    className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs truncate"
                    style={{ background: `${STATUS_COLOR[b.status]}15` }}
                    title={`${b.customer?.full_name} — ${b.service_type}`}
                  >
                    <span
                      className="h-1 w-1 rounded-full shrink-0"
                      style={{ background: STATUS_COLOR[b.status] }}
                    />
                    <span className="truncate text-foreground/80">
                      {b.customer?.full_name ?? b.service_type}
                    </span>
                  </div>
                ))}
                {dayBookings.length > 3 && (
                  <p className="label-caps pl-1">+{dayBookings.length - 3} till</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
