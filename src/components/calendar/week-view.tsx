'use client'

import type { Booking, Profile } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  WEEK_DAYS_SE,
  isSameDay,
  startOfWeek,
  addDays,
  formatTime,
  getBookingsForDay,
  computeBookingLayouts,
  getWeekNumber,
} from './calendar-utils'
import { cn } from '@/lib/utils/cn'
import { useRef, useEffect, useState } from 'react'
import { CreateBookingModal } from './create-booking-modal'

interface Props {
  current: Date
  bookings: Booking[]
  workers?: Profile[]
  onSelectBooking: (b: Booking) => void
  onBookingCreated?: () => void
}

function calcTimePx() {
  const now = new Date()
  return (now.getHours() + now.getMinutes() / 60) * 64
}

function useCurrentTimePx(): number {
  const [px, setPx] = useState(calcTimePx)

  useEffect(() => {
    const id = setInterval(() => setPx(calcTimePx()), 60_000)
    return () => clearInterval(id)
  }, [])

  return px
}

export function WeekView({ current, bookings, workers = [], onSelectBooking, onBookingCreated }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const weekStart = startOfWeek(current)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekNum = getWeekNumber(current)
  const timePx = useCurrentTimePx()
  const [newBookingTime, setNewBookingTime] = useState<Date | null>(null)
  // Vilken kolumn + slot musen hovrar över
  const [hoverInfo, setHoverInfo] = useState<{ dayIndex: number; slot: number } | null>(null)

  function getSlotFromEvent(e: React.MouseEvent<HTMLDivElement>): number {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const scrollTop = (e.currentTarget as HTMLElement).closest('.overflow-y-auto')!.scrollTop
    const y = e.clientY - rect.top + scrollTop
    return Math.floor(y / 64) * 60
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    if ((e.target as HTMLElement).closest('[role="button"]')) return
    const slot = getSlotFromEvent(e)
    const d = new Date(day)
    d.setHours(Math.floor(slot / 60), slot % 60, 0, 0)
    setNewBookingTime(d)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * 64
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
            const layouts = computeBookingLayouts(dayBookings)
            const isToday = isSameDay(day, today)

            return (
              <div
                key={di}
                onClick={e => handleColumnClick(e, day)}
                onMouseMove={e => {
                  if ((e.target as HTMLElement).closest('[role="button"]')) { setHoverInfo(null); return }
                  setHoverInfo({ dayIndex: di, slot: getSlotFromEvent(e) })
                }}
                onMouseLeave={() => setHoverInfo(null)}
                className={cn(
                  'relative border-l border-border cursor-pointer',
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

                {/* Hover-slot — lyser upp med + när man rör musen */}
                {hoverInfo?.dayIndex === di && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none flex items-center justify-center"
                    style={{ top: `${(hoverInfo.slot / 60) * 64}px`, height: '64px' }}
                  >
                    <div className="absolute inset-0 bg-primary/10 border-y border-primary/20" />
                    <span className="relative text-primary/70 text-lg font-light leading-none">+</span>
                  </div>
                )}

                {/* Bookings — lane-positioned */}
                {layouts.map(({ booking: b, top, height, lane, totalLanes }) => {
                  const cfg = STATUS_CONFIG[b.status]
                  const gutter = 2
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

                {/* Current time line — updates every minute */}
                {isToday && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${timePx}px` }}>
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-primary ml-[-4px]" />
                      <div className="flex-1 h-px bg-primary" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
