'use client'

import type { Booking } from '@/types'
import {
  STATUS_CONFIG,
  WEEK_DAYS_SE,
  isSameDay,
  formatTime,
  getBookingsForDay,
} from './calendar-utils'
import { cn } from '@/lib/utils/cn'

interface Props {
  current: Date
  bookings: Booking[]
  onSelectBooking: (b: Booking) => void
  onSelectDay: (d: Date) => void
}

function getMonthDays(current: Date): Date[] {
  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from Monday
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const start = new Date(firstDay)
  start.setDate(start.getDate() - startDow)

  const endDow = lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay()
  const end = new Date(lastDay)
  end.setDate(end.getDate() + endDow)

  const days: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export function MonthView({ current, bookings, onSelectBooking, onSelectDay }: Props) {
  const days = getMonthDays(current)
  const today = new Date()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEK_DAYS_SE.map(d => (
          <div key={d} className="py-2 text-center label-caps">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
        {days.map(day => {
          const dayBookings = getBookingsForDay(bookings, day)
          const isCurrentMonth = day.getMonth() === current.getMonth()
          const isToday = isSameDay(day, today)

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                'border-b border-r border-border p-1.5 overflow-hidden flex flex-col gap-0.5 cursor-pointer transition-colors',
                !isCurrentMonth && 'opacity-30',
                isToday ? 'bg-primary/5' : 'hover:bg-secondary/30'
              )}
            >
              <span className={cn(
                'self-start inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular font-medium mb-0.5',
                isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}>
                {day.getDate()}
              </span>

              {dayBookings.slice(0, 3).map(b => {
                const cfg = STATUS_CONFIG[b.status]
                return (
                  <div
                    key={b.id}
                    onClick={e => { e.stopPropagation(); onSelectBooking(b) }}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs truncate cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ background: cfg.bg, borderLeft: `2px solid ${cfg.color}` }}
                    title={`${b.customer?.full_name} · ${b.service_type}`}
                  >
                    <span className="truncate font-medium" style={{ color: cfg.color }}>
                      {formatTime(b.scheduled_at)} {b.customer?.full_name ?? b.service_type}
                    </span>
                  </div>
                )
              })}

              {dayBookings.length > 3 && (
                <span className="label-caps pl-1 mt-0.5">+{dayBookings.length - 3} till</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
