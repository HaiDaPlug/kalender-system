'use client'

import type { Booking } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  WEEK_DAYS_SE,
  isSameDay,
  startOfWeek,
  addDays,
  formatTime,
  getBookingTop,
  getBookingHeight,
  getBookingsForDay,
  getWeekNumber,
} from './calendar-utils'
import { cn } from '@/lib/utils/cn'
import { useRef, useEffect } from 'react'

interface Props {
  current: Date
  bookings: Booking[]
  onSelectBooking: (b: Booking) => void
}

export function WeekView({ current, bookings, onSelectBooking }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const weekStart = startOfWeek(current)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekNum = getWeekNumber(current)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * 64 // scroll to 07:00
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid border-b border-border shrink-0" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div className="flex items-end justify-center pb-2">
          <span className="label-caps text-primary">V{weekNum}</span>
        </div>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={i} className="py-2 text-center flex flex-col items-center gap-0.5">
              <span className="label-caps">{WEEK_DAYS_SE[i]}</span>
              <span className={cn(
                'h-7 w-7 flex items-center justify-center rounded-full text-sm tabular font-medium',
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
              )}>
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="relative" style={{ gridTemplateColumns: '48px repeat(7, 1fr)', display: 'grid' }}>
          {/* Hour labels */}
          <div className="col-start-1">
            {HOURS.map(h => (
              <div key={h} className="h-16 flex items-start justify-end pr-2 pt-0.5">
                <span className="label-caps tabular">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const dayBookings = getBookingsForDay(bookings, day)
            const isToday = isSameDay(day, today)

            return (
              <div
                key={di}
                className={cn(
                  'relative border-l border-border',
                  isToday && 'bg-primary/3'
                )}
                style={{ height: `${HOURS.length * 64}px` }}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/50"
                    style={{ top: `${h * 64}px` }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div
                    key={`h${h}`}
                    className="absolute left-0 right-0 border-t border-border/20"
                    style={{ top: `${h * 64 + 32}px` }}
                  />
                ))}

                {/* Bookings */}
                {dayBookings.map(b => {
                  const cfg = STATUS_CONFIG[b.status]
                  const top = getBookingTop(b.scheduled_at)
                  const height = getBookingHeight(b.estimated_duration_minutes)

                  return (
                    <div
                      key={b.id}
                      onClick={() => onSelectBooking(b)}
                      className="absolute left-1 right-1 rounded overflow-hidden cursor-pointer hover:brightness-110 transition-all z-10"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        background: cfg.bg,
                        borderLeft: `2px solid ${cfg.color}`,
                      }}
                      title={`${b.customer?.full_name} · ${b.service_type}`}
                    >
                      <div className="px-1.5 py-1 h-full flex flex-col justify-start gap-0.5 overflow-hidden">
                        <p
                          className="text-xs font-semibold leading-tight truncate"
                          style={{ color: cfg.color }}
                        >
                          {formatTime(b.scheduled_at)} {b.customer?.full_name ?? '—'}
                        </p>
                        {height > 36 && (
                          <p className="text-xs truncate" style={{ color: cfg.color, opacity: 0.75 }}>
                            {b.car?.make} {b.car?.model}
                            {b.car?.license_plate && ` · ${b.car.license_plate}`}
                          </p>
                        )}
                        {height > 52 && b.assigned_worker && (
                          <p className="text-xs truncate" style={{ color: cfg.color, opacity: 0.6 }}>
                            {b.assigned_worker.full_name}
                          </p>
                        )}
                        {/* SMS dot */}
                        {height > 36 && (
                          <div className="absolute top-1 right-1.5">
                            <div
                              className="h-1.5 w-1.5 rounded-full"
                              title={b.sms_confirmation_sent ? 'SMS skickat' : 'SMS ej skickat'}
                              style={{ background: b.sms_confirmation_sent ? '#3DAB6A' : '#6B6870' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Current time line */}
                {isToday && (() => {
                  const now = new Date()
                  const topPx = (now.getHours() + now.getMinutes() / 60) * 64
                  return (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${topPx}px` }}>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-primary ml-[-4px]" />
                        <div className="flex-1 h-px bg-primary" />
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
