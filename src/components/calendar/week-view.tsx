'use client'

import type { CSSProperties } from 'react'
import { useRef, useEffect, useState, useMemo } from 'react'
import type { Booking, Profile } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  WEEK_DAYS_SE,
  HOUR_PX,
  TIME_COL_PX,
  CAL_GRID_VARS,
  isSameDay,
  isWeekend,
  startOfWeek,
  addDays,
  formatTime,
  getDaySegments,
  computeBookingLayouts,
  getWeekNumber,
} from './calendar-utils'
import { cn } from '@/lib/utils/cn'
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

export function WeekView({ current, bookings, workers = [], onSelectBooking, onBookingCreated }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const weekNum = getWeekNumber(current)
  const { px: timePx, label: timeLabel } = useCurrentTime()
  const [newBookingTime, setNewBookingTime] = useState<Date | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ dayIndex: number; slot: number } | null>(null)

  const weekDays = useMemo(() => {
    const ws = startOfWeek(current)
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  }, [current])

  // Lane layouts per day are only recomputed when the data or the week changes,
  // not on every hover re-render.
  const dayLayouts = useMemo(
    () => weekDays.map(day => computeBookingLayouts(getDaySegments(bookings, day))),
    [bookings, weekDays],
  )

  const todayInView = weekDays.some(d => isSameDay(d, today))

  function getSlotFromEvent(e: React.MouseEvent<HTMLDivElement>): number {
    const scrollEl = scrollRef.current
    if (!scrollEl) return 0
    const rect = scrollEl.getBoundingClientRect()
    const y = e.clientY - rect.top + scrollEl.scrollTop
    const slotPx = HOUR_PX / 4 // 15-min snap
    return Math.max(0, Math.min(24 * 60 - 15, Math.floor(y / slotPx) * 15))
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    if ((e.target as HTMLElement).closest('.cal-block')) return
    const slot = getSlotFromEvent(e)
    const d = new Date(day)
    d.setHours(Math.floor(slot / 60), slot % 60, 0, 0)
    setNewBookingTime(d)
  }

  useEffect(() => {
    if (scrollRef.current) {
      const target = todayInView
        ? timePx - scrollRef.current.clientHeight / 2
        : 7 * HOUR_PX
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${TIME_COL_PX}px repeat(7, 1fr)`,
    ...CAL_GRID_VARS,
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid border-b border-border shrink-0" style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(7, 1fr)` }}>
        <div className="flex items-center justify-center">
          <span className="label-caps text-primary">V{weekNum}</span>
        </div>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          const count = dayLayouts[i].length
          return (
            <div
              key={i}
              className={cn('py-2 text-center flex flex-col items-center gap-0.5 border-l border-border/40', isWeekend(day) && 'text-muted-foreground')}
            >
              <span className="label-caps" style={{ fontSize: 'calc(0.65rem + 2px)' }}>{WEEK_DAYS_SE[i]}</span>
              <span
                className={cn(
                  'h-9 w-9 flex items-center justify-center rounded-full tabular font-medium',
                  isToday
                    ? 'bg-primary text-primary-foreground shadow-[0_2px_10px_-2px_rgba(245,200,66,0.6)]'
                    : 'text-foreground'
                )}
                style={{ fontSize: 'calc(0.65rem + 6px)' }}
              >
                {day.getDate()}
              </span>
              <span className={cn('text-[10px] tabular leading-none h-3', count ? 'text-muted-foreground' : 'text-transparent')}>
                {count} {count === 1 ? 'bokning' : 'bokningar'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
        <div className="cal-grid relative" style={gridStyle}>
          {/* Hour labels + "now" label */}
          <div className="col-start-1 relative">
            {HOURS.map(h => (
              <div key={h} className="flex items-start justify-end pr-2.5 pt-0.5" style={{ height: HOUR_PX }}>
                <span className="label-caps tabular" style={{ fontSize: 'calc(0.65rem + 3px)' }}>{pad(h)}:00</span>
              </div>
            ))}
            {todayInView && (
              <span className="cal-now-label" style={{ top: `${timePx}px` }}>{timeLabel}</span>
            )}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const layouts = dayLayouts[di]
            const isToday = isSameDay(day, today)

            return (
              <div
                key={di}
                onClick={e => handleColumnClick(e, day)}
                onMouseMove={e => {
                  if ((e.target as HTMLElement).closest('.cal-block')) {
                    setHoverInfo(prev => (prev === null ? prev : null))
                    return
                  }
                  const slot = getSlotFromEvent(e)
                  setHoverInfo(prev => (prev && prev.dayIndex === di && prev.slot === slot) ? prev : { dayIndex: di, slot })
                }}
                onMouseLeave={() => setHoverInfo(null)}
                data-today={isToday}
                data-weekend={isWeekend(day)}
                className="cal-column border-l border-border/60 cursor-pointer"
                style={{ height: `${HOURS.length * HOUR_PX}px` }}
              >
                {/* Hover slot — 30 min, snapped to 15 */}
                {hoverInfo?.dayIndex === di && (
                  <div
                    className="cal-hover-slot"
                    style={{ top: `${(hoverInfo.slot / 60) * HOUR_PX}px`, height: `${HOUR_PX / 2}px` }}
                  >
                    {pad(Math.floor(hoverInfo.slot / 60))}:{pad(hoverInfo.slot % 60)}
                  </div>
                )}

                {/* Bookings — lane-positioned */}
                {layouts.map(({ booking: b, top, height, lane, totalLanes, continuesFromPrev, continuesToNext }) => {
                  const cfg = STATUS_CONFIG[b.status]
                  const gutter = 2
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
                      title={`${b.customer?.full_name ?? ''} · ${b.service_type}`}
                    >
                      <div className="px-1.5 py-1 h-full flex flex-col justify-start gap-0.5 overflow-hidden">
                        <p className="cal-block-title text-xs truncate">
                          <span className="cal-block-time">{continuesFromPrev ? '↳' : formatTime(b.scheduled_at)}</span>
                          {' '}{b.customer?.full_name ?? '—'}
                        </p>
                        {height > 36 && (
                          <p className="cal-block-meta text-[11px] truncate">
                            {b.car?.make} {b.car?.model}
                            {b.car?.license_plate && ` · ${b.car.license_plate}`}
                          </p>
                        )}
                        {height > 52 && (
                          <p className="cal-block-meta text-[11px] truncate">
                            {b.service_type}
                            {b.assigned_worker && ` · ${b.assigned_worker.full_name}`}
                          </p>
                        )}
                        {height > 36 && (
                          <div
                            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
                            title={b.sms_confirmation_sent ? 'SMS skickat' : 'SMS ej skickat'}
                            style={{ background: b.sms_confirmation_sent ? 'var(--status-completed)' : 'var(--status-not-started)' }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Current time line — spans all 7 day columns */}
          {todayInView && (
            <div className="cal-now-line" style={{ top: `${timePx}px`, left: `${TIME_COL_PX}px` }} />
          )}
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
