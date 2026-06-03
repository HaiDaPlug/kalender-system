import type { Booking } from '@/types'

export type CalendarView = 'dag' | 'vecka' | 'månad'

export const STATUS_CONFIG = {
  pending:     { label: 'Väntande',   color: '#C4962A', bg: '#C4962A20', border: '#C4962A60' },
  confirmed:   { label: 'Bekräftad', color: '#4A90D9', bg: '#4A90D920', border: '#4A90D960' },
  in_progress: { label: 'Pågående',  color: '#8B5CF6', bg: '#8B5CF620', border: '#8B5CF660' },
  completed:   { label: 'Klar',      color: '#3DAB6A', bg: '#3DAB6A20', border: '#3DAB6A60' },
  cancelled:   { label: 'Avbokad',   color: '#E05252', bg: '#E0525220', border: '#E0525260' },
} as const

export const HOURS = Array.from({ length: 24 }, (_, i) => i)
export const WEEK_DAYS_SE = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
export const MONTHS_SE = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
]

export function getBookingTop(scheduled_at: string): number {
  const d = new Date(scheduled_at)
  return (d.getHours() + d.getMinutes() / 60) * 64
}

export function getBookingHeight(duration_minutes: number): number {
  return Math.max((duration_minutes / 60) * 64, 28)
}

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
