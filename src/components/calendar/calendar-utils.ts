import type { Booking, BookingStatus } from '@/types'
import { BOOKING_STATUS } from '@/lib/status'

export type CalendarView = 'dag' | 'vecka' | 'månad'

export interface CalendarStatusStyle {
  label: string
  color: string
  bg: string
  border: string
  chipBg: string
}

// Colors reference the CSS custom properties in globals.css (--status-*) via the
// shared status module so the calendar stays in sync with the rest of the app.
// bg/border use color-mix since these are consumed as inline styles (dynamic
// per-booking position), which Tailwind's static class scanner can't reach.
function statusStyle(status: BookingStatus): CalendarStatusStyle {
  const { label, color } = BOOKING_STATUS[status]
  return {
    label,
    color,
    bg:     `color-mix(in srgb, ${color} 16%, transparent)`,
    border: `color-mix(in srgb, ${color} 42%, transparent)`,
    chipBg: `color-mix(in srgb, ${color} 18%, transparent)`,
  }
}

export const STATUS_CONFIG: Record<BookingStatus, CalendarStatusStyle> = {
  pending:     statusStyle('pending'),
  confirmed:   statusStyle('confirmed'),
  in_progress: statusStyle('in_progress'),
  completed:   statusStyle('completed'),
  cancelled:   statusStyle('cancelled'),
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i)
export const HOUR_PX = 60
export const TIME_COL_PX = 80
// Phones: the hour column shrinks, and each day column gets a minimum width so
// the week scrolls sideways instead of clipping Sat/Sun. 88px ≈ 4 days on a
// 390px screen and fits "08:00 Anders".
export const TIME_COL_PX_MOBILE = 48
export const MIN_DAY_COL_PX = 88
// One-letter weekday labels for the month view on narrow screens.
export const WEEK_DAYS_SE_SHORT = ['M', 'T', 'O', 'T', 'F', 'L', 'S']
// Swipe vs. tap: a pointer that moved more than this before "click" was a scroll.
export const TAP_TOLERANCE_PX = 10
// Hours outside this window are shaded in the day/week grids.
export const WORK_START_HOUR = 7
export const WORK_END_HOUR = 19

// CSS custom properties consumed by .cal-grid / .cal-column in globals.css.
export const CAL_GRID_VARS = {
  '--hour-px': `${HOUR_PX}px`,
  '--work-start': String(WORK_START_HOUR),
  '--work-end': String(WORK_END_HOUR),
} as const

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

// Groups bookings by the local calendar day they start on (for the month view).
export function groupBookingsByDay(bookings: Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>()
  for (const b of bookings) {
    const key = dateKey(new Date(b.scheduled_at))
    const list = map.get(key)
    if (list) list.push(b)
    else map.set(key, [b])
  }
  return map
}
export const WEEK_DAYS_SE = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
export const MONTHS_SE = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
]

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDate(date: Date, style: 'short' | 'long' = 'short'): string {
  if (style === 'long') {
    return `${date.getDate()} ${MONTHS_SE[date.getMonth()]} ${date.getFullYear()}`
  }
  return `${date.getDate()} ${MONTHS_SE[date.getMonth()].slice(0, 3)}`
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getBookingsForDay(bookings: Booking[], day: Date): Booking[] {
  return bookings.filter(b => isSameDay(new Date(b.scheduled_at), day))
}

export interface DaySegment {
  booking: Booking
  startMin: number
  endMin: number
  continuesFromPrev: boolean
  continuesToNext: boolean
}

/**
 * Clips a booking to the [00:00, 24:00) window of `day`. Returns null if the
 * booking doesn't touch this day at all. A booking that starts today and runs
 * past midnight gets continuesToNext=true here, and shows up again as a
 * continuesFromPrev segment when this is called for the next day.
 */
export function getBookingSegmentForDay(booking: Booking, day: Date): DaySegment | null {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const start = new Date(booking.scheduled_at)
  const end = new Date(start.getTime() + booking.estimated_duration_minutes * 60000)

  if (end <= dayStart || start >= dayEnd) return null

  const clampedStart = start < dayStart ? dayStart : start
  const clampedEnd = end > dayEnd ? dayEnd : end

  return {
    booking,
    startMin: (clampedStart.getTime() - dayStart.getTime()) / 60000,
    endMin: (clampedEnd.getTime() - dayStart.getTime()) / 60000,
    continuesFromPrev: start < dayStart,
    continuesToNext: end > dayEnd,
  }
}

export function getDaySegments(bookings: Booking[], day: Date): DaySegment[] {
  return bookings
    .map(b => getBookingSegmentForDay(b, day))
    .filter((s): s is DaySegment => s !== null)
}

export interface BookingLayout {
  booking: Booking
  top: number
  height: number
  lane: number
  totalLanes: number
  continuesFromPrev: boolean
  continuesToNext: boolean
}

/**
 * Computes non-overlapping lane positions for a set of booking segments on the
 * same day. Segments that overlap in time are assigned to different lanes so
 * they render side-by-side rather than on top of each other.
 */
export function computeBookingLayouts(segments: DaySegment[]): BookingLayout[] {
  if (segments.length === 0) return []

  // Sort by start time, then by duration descending (wider first)
  const sorted = [...segments].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin
    return (b.endMin - b.startMin) - (a.endMin - a.startMin)
  })

  const layouts: BookingLayout[] = sorted.map(s => ({
    booking: s.booking,
    top: s.startMin * (HOUR_PX / 60),
    height: Math.max((s.endMin - s.startMin) * (HOUR_PX / 60), 28),
    lane: 0,
    totalLanes: 1,
    continuesFromPrev: s.continuesFromPrev,
    continuesToNext: s.continuesToNext,
  }))

  // Assign lanes: find the first lane not occupied by an overlapping earlier booking
  const endTimes: number[] = []

  for (let i = 0; i < layouts.length; i++) {
    const cur = layouts[i]
    const startPx = cur.top
    const endPx = cur.top + cur.height

    let lane = 0
    while (endTimes[lane] !== undefined && endTimes[lane] > startPx) {
      lane++
    }
    cur.lane = lane
    endTimes[lane] = endPx
  }

  // Re-calculate totalLanes per booking based on its actual overlap group
  for (let i = 0; i < layouts.length; i++) {
    const cur = layouts[i]
    let groupMax = cur.lane
    for (let j = 0; j < layouts.length; j++) {
      if (i === j) continue
      const other = layouts[j]
      const overlapStart = Math.max(cur.top, other.top)
      const overlapEnd = Math.min(cur.top + cur.height, other.top + other.height)
      if (overlapEnd > overlapStart) {
        groupMax = Math.max(groupMax, other.lane)
      }
    }
    cur.totalLanes = groupMax + 1
  }

  return layouts
}
