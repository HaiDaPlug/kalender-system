'use client'

import type { Booking, Profile } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  HOUR_PX,
  MONTHS_SE,
  WEEK_DAYS_SE,
  isSameDay,
  formatTime,
  getBookingsForDay,
  computeBookingLayouts,
} from './calendar-utils'
import { useRef, useEffect, useState } from 'react'
import { CreateBookingModal } from './create-booking-modal'

interface Props {
  current: Date
  bookings: Booking[]
  workers?: Profile[]
  onSelectBooking: (b: Booking) => void
  onBookingCreated?: () => void
}

function calcTime() {
  const now = new Date()
  const px = (now.getHours() + now.getMinutes() / 60) * HOUR_PX
  const label = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return { px, label }
}

function useCurrentTime() {
  const [time, setTime] = useState(calcTime)
  useEffect(() => {
    const id = setInterval(() => setTime(calcTime()), 60_000)
    return () => clearInterval(id)
  }, [])
  return time
}

export function DayView({ current, bookings, workers = [], onSelectBooking, onBookingCreated }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const isToday = isSameDay(current, today)
  const dayBookings = getBookingsForDay(bookings, current)
  const layouts = computeBookingLayouts(dayBookings)
  const dowIndex = current.getDay() === 0 ? 6 : current.getDay() - 1
  const { px: timePx } = useCurrentTime()
  const [newBookingTime, setNewBookingTime] = useState<Date | null>(null)
  // Vilken 30-min slot musen hovrar över (i minuter från midnatt)
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)

  function getSlotFromEvent(e: React.MouseEvent<HTMLDivElement>): number {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    const y = e.clientY - rect.top + scrollTop
    return Math.floor(y / HOUR_PX) * 60
  }

  useEffect(() => {
    if (scrollRef.current) {
      const target = isToday
        ? timePx - scrollRef.current.clientHeight / 2
        : 7 * HOUR_PX
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day header */}
      <div className="border-b border-border px-6 py-3 shrink-0 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{WEEK_DAYS_SE[dowIndex]}</span>
        <span className={`text-2xl font-300 tabular ${isToday ? 'text-primary' : 'text-foreground'}`}>
          {current.getDate()}
        </span>
        <span className="text-sm text-muted-foreground">
          {MONTHS_SE[current.getMonth()]} {current.getFullYear()}
        </span>
        <div className="ml-auto label-caps">
          {dayBookings.length} {dayBookings.length === 1 ? 'bokning' : 'bokningar'}
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="relative flex" style={{ height: `${HOURS.length * HOUR_PX}px` }}>
          {/* Hour labels */}
          <div className="w-12 shrink-0 relative">
            {HOURS.map(h => (
              <div key={h} className="h-16 flex items-start justify-end pr-2 pt-0.5">
                <span className="label-caps tabular">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Events column */}
          <div
            className="flex-1 relative border-l border-border cursor-pointer"
            onMouseMove={e => {
              if ((e.target as HTMLElement).closest('[role="button"]')) { setHoverSlot(null); return }
              setHoverSlot(getSlotFromEvent(e))
            }}
            onMouseLeave={() => setHoverSlot(null)}
            onClick={e => {
              if ((e.target as HTMLElement).closest('[role="button"]')) return
              const slot = getSlotFromEvent(e)
              const d = new Date(current)
              d.setHours(Math.floor(slot / 60), slot % 60, 0, 0)
              setNewBookingTime(d)
            }}
          >
            {/* Hour lines */}
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 border-t border-border/50" style={{ top: `${h * HOUR_PX}px` }} />
            ))}
            {HOURS.map(h => (
              <div key={`h${h}`} className="absolute left-0 right-0 border-t border-border/20" style={{ top: `${h * HOUR_PX + HOUR_PX / 2}px` }} />
            ))}

            {/* Hover-slot — lyser upp med + när man rör musen över en ledig tid */}
            {hoverSlot !== null && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none flex items-center justify-center animate-fade-in"
                style={{ top: `${(hoverSlot / 60) * HOUR_PX}px`, height: `${HOUR_PX}px` }}
              >
                <div className="absolute inset-0 bg-primary/8 border-y border-primary/15 transition-all duration-150" />
                <span className="relative text-primary/60 text-xl font-light leading-none">+</span>
              </div>
            )}

            {/* Bookings — lane-positioned to avoid overlap */}
            {layouts.map(({ booking: b, top, height, lane, totalLanes }) => {
              const cfg = STATUS_CONFIG[b.status]
              const gutter = 4
              const colW = `calc((100% - ${gutter}px) / ${totalLanes})`
              const colLeft = `calc(${lane} * (100% - ${gutter}px) / ${totalLanes} + ${lane > 0 ? gutter / totalLanes : 0}px)`

              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBooking(b)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onSelectBooking(b)}
                  className="absolute rounded overflow-hidden cursor-pointer hover:brightness-110 transition-all z-10"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: colLeft,
                    width: colW,
                    background: cfg.bg,
                    borderLeft: `3px solid ${cfg.color}`,
                  }}
                >
                  <div className="px-3 py-1.5 h-full flex flex-col gap-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight truncate" style={{ color: cfg.color }}>
                        {b.customer?.full_name ?? '—'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          title={b.sms_confirmation_sent ? 'SMS skickat' : 'SMS ej skickat'}
                          style={{ background: b.sms_confirmation_sent ? '#3DAB6A' : '#6B6870' }}
                        />
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ color: cfg.color, background: `${cfg.color}25` }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {height > 40 && (
                      <p className="text-xs truncate" style={{ color: cfg.color, opacity: 0.75 }}>
                        {b.car?.make} {b.car?.model}
                        {b.car?.license_plate && (
                          <span className="ml-1 font-medium tracking-widest uppercase">
                            · {b.car.license_plate}
                          </span>
                        )}
                      </p>
                    )}

                    {height > 56 && (
                      <p className="text-xs" style={{ color: cfg.color, opacity: 0.7 }}>
                        {formatTime(b.scheduled_at)} · {b.estimated_duration_minutes} min
                        {b.assigned_worker && ` · ${b.assigned_worker.full_name}`}
                      </p>
                    )}

                    {height > 72 && b.customer_notes && (
                      <p className="text-xs italic truncate" style={{ color: cfg.color, opacity: 0.55 }}>
                        {b.customer_notes}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Current time line — updates every minute */}
            {isToday && (
              <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${timePx}px` }}>
                <div className="flex items-center gap-0">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 ml-[-4px]" />
                  <div className="flex-1 h-px bg-primary" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {newBookingTime && (
        <CreateBookingModal
          initialDate={newBookingTime}
          workers={workers}
          onClose={() => setNewBookingTime(null)}
          onCreated={() => {
            setNewBookingTime(null)
            onBookingCreated?.()
          }}
        />
      )}
    </div>
  )
}
