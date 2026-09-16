'use client'

import type { CSSProperties } from 'react'
import { useRef, useEffect, useState, useMemo } from 'react'
import type { Booking, Profile } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  HOUR_PX,
  TIME_COL_PX,
  TIME_COL_PX_MOBILE,
  TAP_TOLERANCE_PX,
  CAL_GRID_VARS,
  MONTHS_SE,
  WEEK_DAYS_SE,
  isSameDay,
  isWeekend,
  formatTime,
  getDaySegments,
  computeBookingLayouts,
} from './calendar-utils'
import { cn } from '@/lib/utils/cn'
import { useIsNarrow } from '@/lib/hooks/use-media-query'
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

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function DayView({ current, bookings, workers = [], onSelectBooking, onBookingCreated }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Tap vs. swipe — see week-view.tsx.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const isNarrow = useIsNarrow()
  const today = new Date()
  const isToday = isSameDay(current, today)
  const dowIndex = current.getDay() === 0 ? 6 : current.getDay() - 1
  const { px: timePx, label: timeLabel } = useCurrentTime()
  const [newBookingTime, setNewBookingTime] = useState<Date | null>(null)
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)

  const timeColPx = isNarrow ? TIME_COL_PX_MOBILE : TIME_COL_PX

  const layouts = useMemo(
    () => computeBookingLayouts(getDaySegments(bookings, current)),
    [bookings, current],
  )

  function getSlotFromEvent(e: React.MouseEvent<HTMLDivElement>): number {
    const scrollEl = scrollRef.current
    if (!scrollEl) return 0
    const rect = scrollEl.getBoundingClientRect()
    const y = e.clientY - rect.top + scrollEl.scrollTop
    const slotPx = HOUR_PX / 4
    return Math.max(0, Math.min(24 * 60 - 15, Math.floor(y / slotPx) * 15))
  }

  useEffect(() => {
    if (scrollRef.current) {
      const target = isToday
        ? timePx - scrollRef.current.clientHeight / 2
        : 7 * HOUR_PX
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const totalMinutes = layouts.reduce((sum, l) => sum + l.booking.estimated_duration_minutes, 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day header */}
      <div className="border-b border-border px-3 md:px-6 py-2.5 shrink-0 flex items-center gap-3">
        <span className={cn('text-sm', isWeekend(current) ? 'text-muted-foreground' : 'text-foreground')}>{WEEK_DAYS_SE[dowIndex]}</span>
        <span className={cn(
          'h-9 min-w-9 px-1.5 flex items-center justify-center rounded-full text-xl tabular font-medium',
          isToday ? 'bg-primary text-primary-foreground shadow-[0_2px_10px_-2px_rgba(245,200,66,0.6)]' : 'text-foreground'
        )}>
          {current.getDate()}
        </span>
        <span className="text-sm text-muted-foreground truncate">
          {MONTHS_SE[current.getMonth()]} {current.getFullYear()}
        </span>
        <div className="ml-auto label-caps tabular shrink-0">
          {layouts.length} {layouts.length === 1 ? 'bokning' : 'bokningar'}
          {totalMinutes > 0 && ` · ${Math.round(totalMinutes / 60 * 10) / 10} tim`}
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="cal-grid relative flex" style={{ height: `${HOURS.length * HOUR_PX}px`, ...CAL_GRID_VARS } as CSSProperties}>
          {/* Hour labels + "now" label */}
          <div className="shrink-0 relative" style={{ width: timeColPx }}>
            {HOURS.map(h => (
              <div key={h} className="flex items-start justify-end pr-2 md:pr-2.5 pt-0.5" style={{ height: HOUR_PX }}>
                <span className="label-caps tabular" style={{ fontSize: isNarrow ? '0.65rem' : 'calc(0.65rem + 3px)' }}>{pad(h)}:00</span>
              </div>
            ))}
            {isToday && <span className="cal-now-label" style={{ top: `${timePx}px` }}>{timeLabel}</span>}
          </div>

          {/* Events column */}
          <div
            className="cal-column flex-1 border-l border-border/60 cursor-pointer"
            data-today={isToday}
            data-weekend={isWeekend(current)}
            onPointerDown={e => { pointerStart.current = { x: e.clientX, y: e.clientY } }}
            onMouseMove={e => {
              if (isNarrow) return
              if ((e.target as HTMLElement).closest('.cal-block')) {
                setHoverSlot(prev => (prev === null ? prev : null))
                return
              }
              const slot = getSlotFromEvent(e)
              setHoverSlot(prev => (prev === slot ? prev : slot))
            }}
            onMouseLeave={() => setHoverSlot(null)}
            onClick={e => {
              if ((e.target as HTMLElement).closest('.cal-block')) return
              // A moved pointer was a scroll, not a booking attempt.
              const start = pointerStart.current
              pointerStart.current = null
              if (start && (Math.abs(e.clientX - start.x) > TAP_TOLERANCE_PX || Math.abs(e.clientY - start.y) > TAP_TOLERANCE_PX)) return
              const slot = getSlotFromEvent(e)
              const d = new Date(current)
              d.setHours(Math.floor(slot / 60), slot % 60, 0, 0)
              setNewBookingTime(d)
            }}
          >
            {!isNarrow && hoverSlot !== null && (
              <div
                className="cal-hover-slot text-xs"
                style={{ top: `${(hoverSlot / 60) * HOUR_PX}px`, height: `${HOUR_PX / 2}px` }}
              >
                {pad(Math.floor(hoverSlot / 60))}:{pad(hoverSlot % 60)}
              </div>
            )}

            {/* Bookings — lane-positioned to avoid overlap */}
            {layouts.map(({ booking: b, top, height, lane, totalLanes, continuesFromPrev, continuesToNext }) => {
              const cfg = STATUS_CONFIG[b.status]
              const gutter = 4
              const colW = `calc((100% - ${gutter}px) / ${totalLanes})`
              const colLeft = `calc(${lane} * (100% - ${gutter}px) / ${totalLanes} + ${lane > 0 ? gutter / totalLanes : 0}px)`

              return (
                <div
                  key={`${b.id}${continuesFromPrev ? '-cont' : ''}`}
                  onClick={() => onSelectBooking(b)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onSelectBooking(b)}
                  className={cn(
                    'cal-block',
                    continuesFromPrev ? 'rounded-b-md' : continuesToNext ? 'rounded-t-md' : 'rounded-md'
                  )}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: colLeft,
                    width: colW,
                    '--c': cfg.color,
                    borderTop: continuesFromPrev ? `2px dashed ${cfg.color}` : undefined,
                    borderBottom: continuesToNext ? `2px dashed ${cfg.color}` : undefined,
                  } as CSSProperties}
                >
                  <div className="px-2 md:px-3 py-1.5 h-full flex flex-col gap-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <p className="cal-block-title text-sm truncate">
                        <span className="cal-block-time">{continuesFromPrev ? '↳' : formatTime(b.scheduled_at)}</span>
                        {' '}{b.customer?.full_name ?? '—'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          title={b.sms_confirmation_sent ? 'SMS skickat' : 'SMS ej skickat'}
                          style={{ background: b.sms_confirmation_sent ? 'var(--status-completed)' : 'var(--status-not-started)' }}
                        />
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded-sm font-semibold"
                          style={{ color: cfg.color, background: cfg.chipBg }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {height > 40 && (
                      <p className="cal-block-meta text-xs truncate">
                        {b.car?.make} {b.car?.model}
                        {b.car?.license_plate && <span className="plate ml-1.5">{b.car.license_plate}</span>}
                      </p>
                    )}

                    {height > 56 && (
                      <p className="cal-block-meta text-xs truncate">
                        {b.service_type} · {b.estimated_duration_minutes} min
                        {b.assigned_worker && ` · ${b.assigned_worker.full_name}`}
                      </p>
                    )}

                    {height > 72 && b.customer_notes && (
                      <p className="cal-block-meta text-xs italic truncate">
                        {b.customer_notes}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Current time line */}
            {isToday && <div className="cal-now-line" style={{ top: `${timePx}px` }} />}
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
