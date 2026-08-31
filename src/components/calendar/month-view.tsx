'use client'

import type { Booking } from '@/types'
import {
  STATUS_CONFIG,
  WEEK_DAYS_SE,
  WEEK_DAYS_SE_SHORT,
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
        {WEEK_DAYS_SE.map((d, i) => (
          <div key={d} className="py-2 text-center label-caps">
            {/* Fulla namn ryms inte i 7 kolumner på mobil */}
            <span className="md:hidden">{WEEK_DAYS_SE_SHORT[i]}</span>
            <span className="hidden md:inline">{d}</span>
          </div>
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

              {/* Mobil: färgprickar. Textrader blir oläsbara i en 7-kolumners
                  grid på telefon — tryck på dagen öppnar dagvyn istället. */}
              <div className="flex flex-wrap gap-1 md:hidden">
                {dayBookings.slice(0, 6).map(b => (
                  <div
                    key={b.id}
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: STATUS_CONFIG[b.status].color }}
                  />
                ))}
                {dayBookings.length > 6 && (
                  <span className="text-[0.55rem] leading-none text-muted-foreground">
                    +{dayBookings.length - 6}
                  </span>
                )}
              </div>

              {/* Desktop: läsbara rader med tid och kundnamn */}
              <div className="hidden md:flex md:flex-col md:gap-0.5 min-h-0">
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
