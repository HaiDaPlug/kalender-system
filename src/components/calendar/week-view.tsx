'use client'

import type { CSSProperties } from 'react'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Booking, Profile } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  WEEK_DAYS_SE,
  HOUR_PX,
  TIME_COL_PX,
  TIME_COL_PX_MOBILE,
  MIN_DAY_COL_PX,
  TAP_TOLERANCE_PX,
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

interface XScroll { can: boolean; atStart: boolean; atEnd: boolean }

export function WeekView({ current, bookings, workers = [], onSelectBooking, onBookingCreated }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // The header row scrolls sideways in step with the grid.
  const headerScrollRef = useRef<HTMLDivElement>(null)
  // Where a pointer went down — to tell a tap from a swipe/scroll. Without it
  // the booking modal opened every time you swiped between days on a phone.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const isNarrow = useIsNarrow()
  const today = new Date()
  const weekNum = getWeekNumber(current)
  const { px: timePx, label: timeLabel } = useCurrentTime()
  const [newBookingTime, setNewBookingTime] = useState<Date | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ dayIndex: number; slot: number } | null>(null)
  const [xScroll, setXScroll] = useState<XScroll>({ can: false, atStart: true, atEnd: false })

  const timeColPx = isNarrow ? TIME_COL_PX_MOBILE : TIME_COL_PX
  // Phones: each day gets a minimum width so the week is wider than the screen
  // and scrolls sideways instead of clipping Sat/Sun. Desktop: 7 equal columns.
  const gridColumns = isNarrow
    ? `${timeColPx}px repeat(7, minmax(${MIN_DAY_COL_PX}px, 1fr))`
    : `${timeColPx}px repeat(7, 1fr)`

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

  const updateXScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const next: XScroll = {
      can: el.scrollWidth > el.clientWidth + 4,
      atStart: el.scrollLeft <= 4,
      atEnd: el.scrollLeft >= el.scrollWidth - el.clientWidth - 4,
    }
    setXScroll(prev => (prev.can === next.can && prev.atStart === next.atStart && prev.atEnd === next.atEnd) ? prev : next)
  }, [])

  function syncHeaderScroll() {
    if (headerScrollRef.current && scrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft
    }
  }

  function handleGridScroll() {
    syncHeaderScroll()
    updateXScroll()
  }

  // Page two day columns at a time with the overlay arrows.
  function scrollByDays(dir: -1 | 1) {
    const el = scrollRef.current
    if (!el) return
    const colW = (el.scrollWidth - timeColPx) / 7
    el.scrollBy({ left: dir * colW * 2, behavior: 'smooth' })
  }

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

    // Did the finger move? Then it was a swipe, not an attempt to book.
    const start = pointerStart.current
    pointerStart.current = null
    if (start && (Math.abs(e.clientX - start.x) > TAP_TOLERANCE_PX || Math.abs(e.clientY - start.y) > TAP_TOLERANCE_PX)) return

    const slot = getSlotFromEvent(e)
    const d = new Date(day)
    d.setHours(Math.floor(slot / 60), slot % 60, 0, 0)
    setNewBookingTime(d)
  }

  // Vertical autoscroll on mount: current time if today is in view, else 07:00.
  useEffect(() => {
    if (scrollRef.current) {
      const target = todayInView
        ? timePx - scrollRef.current.clientHeight / 2
        : 7 * HOUR_PX
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Horizontal autoscroll to today's column + keep the arrow state current.
  // Runs in rAF because scrollWidth is wrong before layout has settled.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const id = requestAnimationFrame(() => {
      const todayIndex = weekDays.findIndex(d => isSameDay(d, new Date()))
      if (todayIndex >= 0 && el.scrollWidth > el.clientWidth) {
        const colW = (el.scrollWidth - timeColPx) / 7
        el.scrollLeft = Math.max(0, todayIndex * colW - (el.clientWidth - timeColPx - colW) / 2)
        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = el.scrollLeft
      }
      updateXScroll()
    })
    window.addEventListener('resize', updateXScroll)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', updateXScroll)
    }
  }, [weekDays, timeColPx, updateXScroll])

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridColumns,
    ...CAL_GRID_VARS,
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers — scroll sideways in step with the grid */}
      <div ref={headerScrollRef} className="border-b border-border shrink-0 overflow-x-hidden">
        <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
          <div className="flex items-center justify-center sticky left-0 z-20 bg-background">
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
      </div>

      {/* Grid — scrolls vertically (hours) and, on phones, horizontally (days).
          The wrapper is relative for the overlay arrows. */}
      <div className="relative flex-1 min-h-0 flex">
        {isNarrow && xScroll.can && !xScroll.atStart && (
          <button
            onClick={() => scrollByDays(-1)}
            aria-label="Visa tidigare dagar"
            className="btn btn-secondary btn-icon rounded-full absolute top-1/2 -translate-y-1/2 z-30 shadow-lg"
            style={{ left: `${timeColPx + 6}px` }}
          >
            <ChevronLeft />
          </button>
        )}
        {isNarrow && xScroll.can && !xScroll.atEnd && (
          <button
            onClick={() => scrollByDays(1)}
            aria-label="Visa fler dagar"
            className="btn btn-secondary btn-icon rounded-full absolute right-2 top-1/2 -translate-y-1/2 z-30 shadow-lg"
          >
            <ChevronRight />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={handleGridScroll}
          className="flex-1 overflow-auto min-h-0 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="cal-grid relative" style={gridStyle}>
            {/* Hour labels + "now" label — pinned to the left when scrolling sideways */}
            <div className="col-start-1 relative sticky left-0 z-20 bg-background">
              {HOURS.map(h => (
                <div key={h} className="flex items-start justify-end pr-2 md:pr-2.5 pt-0.5" style={{ height: HOUR_PX }}>
                  <span className="label-caps tabular" style={{ fontSize: isNarrow ? '0.65rem' : 'calc(0.65rem + 3px)' }}>{pad(h)}:00</span>
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
                  onPointerDown={e => { pointerStart.current = { x: e.clientX, y: e.clientY } }}
                  onMouseMove={e => {
                    if (isNarrow) return
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
                  {/* Hover slot — desktop only (30 min, snapped to 15) */}
                  {!isNarrow && hoverInfo?.dayIndex === di && (
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
              <div className="cal-now-line" style={{ top: `${timePx}px`, left: `${timeColPx}px` }} />
            )}
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
