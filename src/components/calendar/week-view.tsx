'use client'

import type { Booking, Profile } from '@/types'
import {
  STATUS_CONFIG,
  HOURS,
  WEEK_DAYS_SE,
  HOUR_PX,
  TIME_COL_PX,
  TIME_COL_PX_MOBILE,
  MIN_DAY_COL_PX,
  isSameDay,
  startOfWeek,
  addDays,
  formatTime,
  getDaySegments,
  computeBookingLayouts,
  getWeekNumber,
} from './calendar-utils'
import { cn } from '@/lib/utils/cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  // Rubrikraden scrollar i sidled i takt med rutnätet.
  const headerScrollRef = useRef<HTMLDivElement>(null)
  // Startpunkt för en pekning, för att skilja ett tryck från ett svep.
  // Utan detta öppnas bokningsmodalen varje gång man swipar mellan dagar.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const today = new Date()
  const weekStart = startOfWeek(current)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekNum = getWeekNumber(current)
  const { px: timePx } = useCurrentTime()
  const [newBookingTime, setNewBookingTime] = useState<Date | null>(null)
  // Vilken kolumn + slot musen hovrar över
  const [hoverInfo, setHoverInfo] = useState<{ dayIndex: number; slot: number } | null>(null)
  // Smal skärm = telefonen. Styr tidsaxelns bredd och om pilarna visas.
  const [isNarrow, setIsNarrow] = useState(false)
  const [xScroll, setXScroll] = useState({ can: false, atStart: true, atEnd: false })

  const timeColPx = isNarrow ? TIME_COL_PX_MOBILE : TIME_COL_PX
  // På smal skärm får varje dag en minsta bredd → veckan blir bredare än
  // skärmen och scrollar i sidled istället för att lör/sön klipps bort.
  const gridColumns = isNarrow
    ? `${timeColPx}px repeat(7, minmax(${MIN_DAY_COL_PX}px, 1fr))`
    : `${TIME_COL_PX}px repeat(7, 1fr)`

  function syncHeaderScroll() {
    if (headerScrollRef.current && scrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft
    }
  }

  function updateXScroll() {
    const el = scrollRef.current
    if (!el) return
    setXScroll({
      can: el.scrollWidth > el.clientWidth + 4,
      atStart: el.scrollLeft <= 4,
      atEnd: el.scrollLeft >= el.scrollWidth - el.clientWidth - 4,
    })
  }

  function handleGridScroll() {
    syncHeaderScroll()
    updateXScroll()
  }

  // Bläddra två dagkolumner i taget med pilknapparna.
  function scrollByDay(dir: -1 | 1) {
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
    // Snap to 15-min intervals
    const slotPx = HOUR_PX / 4
    return Math.floor(y / slotPx) * 15
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    if ((e.target as HTMLElement).closest('[role="button"]')) return

    // Rörde sig fingret? Då var det ett svep — inte ett försök att boka.
    const start = pointerStart.current
    pointerStart.current = null
    if (start) {
      const dx = Math.abs(e.clientX - start.x)
      const dy = Math.abs(e.clientY - start.y)
      if (dx > 10 || dy > 10) return
    }

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

  // Följ skärmbredden. 768px matchar Tailwinds md-brytpunkt.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Horisontell autoscroll till dagens kolumn + håll pilarnas läge aktuellt.
  // Körs i rAF eftersom scrollWidth är fel innan layouten mätts klart.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const id = requestAnimationFrame(() => {
      const todayIndex = weekDays.findIndex(d => isSameDay(d, today))
      if (todayIndex >= 0 && el.scrollWidth > el.clientWidth) {
        const colW = (el.scrollWidth - timeColPx) / 7
        const target = todayIndex * colW - (el.clientWidth - timeColPx - colW) / 2
        el.scrollLeft = Math.max(0, target)
        syncHeaderScroll()
      }
      updateXScroll()
    })
    window.addEventListener('resize', updateXScroll)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', updateXScroll)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isNarrow])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers — scrollar i sidled i takt med rutnätet */}
      <div ref={headerScrollRef} className="border-b border-border shrink-0 overflow-x-hidden">
      <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
        <div className="flex items-center justify-center sticky left-0 z-20 bg-card">
          <span className="label-caps text-primary">V{weekNum}</span>
        </div>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={i} className="py-2.5 text-center flex flex-col items-center gap-0.5">
              <span className="label-caps" style={{ fontSize: 'calc(0.65rem + 2px)' }}>{WEEK_DAYS_SE[i]}</span>
              <span
                className={cn(
                  'h-10 w-10 flex items-center justify-center rounded-full tabular font-medium',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                )}
                style={{ fontSize: 'calc(0.65rem + 7px)' }}
              >
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>
      </div>

      {/* Scrollable time grid — scrollar vertikalt (timmar) och på smal skärm
          även horisontellt (dagar). Wrappern är relative för pilknapparna. */}
      <div className="relative flex-1 min-h-0 flex">
        {/* Bläddringspilar — visar att veckan fortsätter utanför skärmen.
            Endast på smal skärm och bara när det faktiskt går att scrolla. */}
        {isNarrow && xScroll.can && !xScroll.atStart && (
          <button
            onClick={() => scrollByDay(-1)}
            aria-label="Visa tidigare dagar"
            className="absolute top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-secondary/95 border border-border shadow-lg flex items-center justify-center text-foreground active:scale-95 transition-transform"
            style={{ left: `${TIME_COL_PX_MOBILE + 4}px` }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {isNarrow && xScroll.can && !xScroll.atEnd && (
          <button
            onClick={() => scrollByDay(1)}
            aria-label="Visa fler dagar"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-secondary/95 border border-border shadow-lg flex items-center justify-center text-foreground active:scale-95 transition-transform"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      <div
        ref={scrollRef}
        onScroll={handleGridScroll}
        className="flex-1 overflow-auto min-h-0 overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="relative" style={{ gridTemplateColumns: gridColumns, display: 'grid' }}>
          {/* Hour labels — fastnaglade till vänster vid sidledsscroll */}
          <div className="col-start-1 relative sticky left-0 z-20 bg-card">
            {HOURS.map(h => (
              <div key={h} className="flex items-start justify-end pr-2.5 pt-0.5" style={{ height: HOUR_PX }}>
                <span className="label-caps tabular" style={{ fontSize: 'calc(0.65rem + 3px)' }}>{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const daySegments = getDaySegments(bookings, day)
            const layouts = computeBookingLayouts(daySegments)
            const isToday = isSameDay(day, today)

            return (
              <div
                key={di}
                onClick={e => handleColumnClick(e, day)}
                onPointerDown={e => { pointerStart.current = { x: e.clientX, y: e.clientY } }}
                onMouseMove={e => {
                  if ((e.target as HTMLElement).closest('[role="button"]')) { setHoverInfo(null); return }
                  setHoverInfo({ dayIndex: di, slot: getSlotFromEvent(e) })
                }}
                onMouseLeave={() => setHoverInfo(null)}
                className={cn(
                  'relative border-l border-border/60 cursor-pointer',
                  isToday && 'bg-primary/3'
                )}
                style={{ height: `${HOURS.length * HOUR_PX}px` }}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: `${h * HOUR_PX}px` }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div
                    key={`h${h}`}
                    className="absolute left-0 right-0 border-t border-border/15"
                    style={{ top: `${h * HOUR_PX + HOUR_PX / 2}px` }}
                  />
                ))}

                {/* Hover-slot — lyser upp med + när man rör musen */}
                {hoverInfo?.dayIndex === di && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none hidden md:block"
                    style={{
                      top: `${(hoverInfo.slot / 60) * HOUR_PX}px`,
                      height: `${HOUR_PX / 2}px`,
                      transition: 'top 80ms ease',
                    }}
                  >
                    <div className="absolute inset-0 bg-primary/10 border-y border-primary/25" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary/70 tabular leading-none" style={{ fontSize: '0.6rem' }}>
                        {String(Math.floor(hoverInfo.slot / 60)).padStart(2, '0')}:{String(hoverInfo.slot % 60).padStart(2, '0')}
                      </span>
                    </div>
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
                        'absolute overflow-hidden cursor-pointer hover:brightness-110 transition-all z-10',
                        continuesFromPrev ? 'rounded-b' : continuesToNext ? 'rounded-t' : 'rounded'
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: colLeft,
                        width: colW,
                        background: cfg.bg,
                        borderLeft: `2px solid ${cfg.color}`,
                        borderTop: continuesFromPrev ? `2px dashed ${cfg.color}` : undefined,
                        borderBottom: continuesToNext ? `2px dashed ${cfg.color}` : undefined,
                      }}
                      title={`${b.customer?.full_name} · ${b.service_type}`}
                    >
                      <div className="px-1.5 py-1 h-full flex flex-col justify-start gap-0.5 overflow-hidden">
                        <p
                          className="text-xs font-semibold leading-tight truncate"
                          style={{ color: cfg.color }}
                        >
                          {continuesFromPrev ? '↳ ' : ''}{formatTime(b.scheduled_at)} {b.customer?.full_name ?? '—'}
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
                              style={{ background: b.sms_confirmation_sent ? 'var(--status-completed)' : 'var(--status-not-started)' }}
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
            style={{ top: `${timePx}px`, paddingLeft: `${timeColPx}px` }}
          >
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-primary shrink-0 ml-[-4px]" />
              <div className="flex-1 h-px bg-primary" />
            </div>
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
