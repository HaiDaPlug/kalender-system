'use client'

import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { Booking } from '@/types'
import {
  STATUS_CONFIG,
  WEEK_DAYS_SE,
  WEEK_DAYS_SE_SHORT,
  isSameDay,
  isWeekend,
  formatTime,
  dateKey,
  groupBookingsByDay,
} from './calendar-utils'
import { cn } from '@/lib/utils/cn'

interface Props {
  current: Date
  bookings: Booking[]
  onSelectBooking: (b: Booking) => void
  onSelectDay: (d: Date) => void
}

const MAX_CHIPS = 3
const MAX_DOTS = 6

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
  const days = useMemo(() => getMonthDays(current), [current])
  // One pass over the bookings instead of filtering the whole list once per cell.
  const byDay = useMemo(() => groupBookingsByDay(bookings), [bookings])
  const today = new Date()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers — one letter on phones, full names on desktop */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEK_DAYS_SE.map((d, i) => (
          <div key={d} className={cn('py-2 text-center label-caps', i >= 5 && 'opacity-70')}>
            <span className="md:hidden">{WEEK_DAYS_SE_SHORT[i]}</span>
            <span className="hidden md:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
        {days.map(day => {
          const dayBookings = byDay.get(dateKey(day)) ?? []
          const isCurrentMonth = day.getMonth() === current.getMonth()
          const isToday = isSameDay(day, today)
          const overflow = dayBookings.length - MAX_CHIPS

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                'relative border-b border-r border-border p-1 md:p-1.5 overflow-hidden flex flex-col gap-0.5 cursor-pointer transition-colors',
                !isCurrentMonth && 'opacity-35',
                isWeekend(day) && 'bg-white/[0.015]',
                isToday ? 'bg-primary/6' : 'hover:bg-secondary/40'
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={cn(
                  'inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-full text-xs tabular font-medium',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}>
                  {day.getDate()}
                </span>
                {dayBookings.length > 0 && (
                  <span className="hidden md:inline text-[10px] text-muted-foreground tabular">{dayBookings.length}</span>
                )}
              </div>

              {/* Phones: colored dots — text rows are unreadable in 7 columns; tapping the day opens the day view */}
              <div className="flex flex-wrap gap-1 md:hidden">
                {dayBookings.slice(0, MAX_DOTS).map(b => (
                  <div
                    key={b.id}
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: STATUS_CONFIG[b.status].color }}
                  />
                ))}
                {dayBookings.length > MAX_DOTS && (
                  <span className="text-[0.55rem] leading-none text-muted-foreground">+{dayBookings.length - MAX_DOTS}</span>
                )}
              </div>

              {/* Desktop: readable chips with time and customer */}
              <div className="hidden md:flex md:flex-col md:gap-0.5 min-h-0">
                {dayBookings.slice(0, MAX_CHIPS).map(b => {
                  const cfg = STATUS_CONFIG[b.status]
                  return (
                    <div
                      key={b.id}
                      onClick={e => { e.stopPropagation(); onSelectBooking(b) }}
                      className="cal-chip"
                      style={{ '--c': cfg.color } as CSSProperties}
                      title={`${b.customer?.full_name} · ${b.service_type}`}
                    >
                      <span className="tabular shrink-0" style={{ color: cfg.color }}>{formatTime(b.scheduled_at)}</span>
                      <span className="truncate font-medium">{b.customer?.full_name ?? b.service_type}</span>
                    </div>
                  )
                })}
                {overflow > 0 && (
                  <span className="label-caps pl-1 mt-0.5">+{overflow} till</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
