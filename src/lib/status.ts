import type { BookingStatus, CleaningJobStatus, ShiftStatus } from '@/types'

/*
  One place for status labels + colors. Every badge, legend, filter and column
  header reads from here so the wording and color for "pending" is the same on
  the dashboard, the calendar, the booking page and the customer history.

  `color` is a CSS custom-property reference (see globals.css) so it works both
  in Tailwind classes and in inline styles for per-item coloring.
*/

export interface StatusMeta {
  label: string
  color: string
}

export const BOOKING_STATUS: Record<BookingStatus, StatusMeta> = {
  pending:     { label: 'Väntar',    color: 'var(--status-pending)' },
  confirmed:   { label: 'Bekräftad', color: 'var(--status-confirmed)' },
  in_progress: { label: 'Pågår',     color: 'var(--status-in-progress)' },
  completed:   { label: 'Klar',      color: 'var(--status-completed)' },
  cancelled:   { label: 'Avbokad',   color: 'var(--status-cancelled)' },
}

export const JOB_STATUS: Record<CleaningJobStatus, StatusMeta> = {
  not_started:  { label: 'Ej påbörjat',       color: 'var(--status-not-started)' },
  in_progress:  { label: 'Pågår',             color: 'var(--status-in-progress)' },
  needs_review: { label: 'Väntar granskning', color: 'var(--status-pending)' },
  completed:    { label: 'Godkänt',           color: 'var(--status-completed)' },
}

export const SHIFT_STATUS: Record<ShiftStatus, StatusMeta> = {
  pending:  { label: 'Väntar',  color: 'var(--status-pending)' },
  approved: { label: 'Godkänt', color: 'var(--status-completed)' },
  rejected: { label: 'Avvisat', color: 'var(--status-cancelled)' },
}

export const BOOKING_STATUSES = Object.keys(BOOKING_STATUS) as BookingStatus[]

export function bookingStatusMeta(status: string): StatusMeta {
  return BOOKING_STATUS[status as BookingStatus] ?? { label: status, color: 'var(--status-not-started)' }
}

export function jobStatusMeta(status: string): StatusMeta {
  return JOB_STATUS[status as CleaningJobStatus] ?? { label: status, color: 'var(--status-not-started)' }
}

export function shiftStatusMeta(status: string): StatusMeta {
  return SHIFT_STATUS[status as ShiftStatus] ?? { label: status, color: 'var(--status-not-started)' }
}
