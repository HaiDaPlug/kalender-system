'use client'

import type { Booking, Profile } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  WEEK_DAYS_SE,
  HOUR_PX,
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

export function WeekView({ current, bookings, workers = [], onSelectBooking, onBookingCreated }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const weekStart = startOfWeek(current)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekNum = getWeekNumber(current)
  const { px: timePx } = useCurrentTime()
  const [newBookingTime, setNewBookingTime] = useState<Date | null>(null)
  // Vilken kolumn + slot musen hovrar över
  const [hoverInfo, setHoverInfo] = useState<{ dayIndex: number; slot: number } | null>(null)

  function getSlotFromEvent(e: React.MouseEvent<HTMLDivElement>): number {
    const scrollEl = scrollRef.current
    if (!scrollEl) return 0
    const rect = scrollEl.getBoundingClientRect()
    const y = e.clientY - rect.top + scrollEl.scrollTop
    // Snap to 15-min intervals
    const slotPx = HOUR_PX / 4
    return Math.floor(y / slotPx) * 15
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
      const todayInView = weekDays.some(d => isSameDay(d, today))
      const target = todayInView
        ? timePx - scrollRef.current.clientHeight / 2
        : 7 * HOUR_PX
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className="col-start-1 relative">
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
                style={{ height: `${HOURS.length * HOUR_PX}px` }}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/50"
                    style={{ top: `${h * HOUR_PX}px` }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div
                    key={`h${h}`}
                    className="absolute left-0 right-0 border-t border-border/20"
                    style={{ top: `${h * HOUR_PX + HOUR_PX / 2}px` }}
                  />
                ))}

                {/* Hover-slot — lyser upp med + när man rör musen */}
                {hoverInfo?.dayIndex === di && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{
                      top: `${(hoverInfo.slot / 60) * HOUR_PX}px`,
                      height: `${HOUR_PX / 2}px`,
                      transition: 'top 80ms ease',
                    }}
                  >
                    <div className="absolute inset-0 bg-primary/10 border-y border-primary/25" />
                    <span className="absolute left-1 top-0.5 text-xs font-medium text-primary/70 tabular leading-none" style={{ fontSize: '0.6rem' }}>
                      {String(Math.floor(hoverInfo.slot / 60)).padStart(2, '0')}:{String(hoverInfo.slot % 60).padStart(2, '0')}
                    </span>
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

              </div>
            )
          })}

          {/* Current time line — spans all 7 day columns, updates every minute */}
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: `${timePx}px`, paddingLeft: '48px' }}
          >
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-primary shrink-0 ml-[-4px]" />
              <div className="flex-1 h-px bg-primary" />
            </div>
          </div>
        </div>
      </div>

      <CreateBookingModal
        key={newBookingTime?.toISOString()}
        open={newBookingTime !== null}
        initialDate={newBookingTime ?? new Date()}
        workers={workers}
        onClose={() => setNewBookingTime(null)}
        onCreated={() => {
          setNewBookingTime(null)
          onBookingCreated?.()
        }}
      />
    </div>
  )
}
