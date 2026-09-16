/*
  Date helpers that are explicit about the business time zone.
  The server (Vercel) runs in UTC, but "today" for the shop means Europe/Stockholm.
*/

export const BUSINESS_TZ = 'Europe/Stockholm'

// "YYYY-MM-DD" for the given instant, in the business time zone.
export function businessDateKey(date: Date = new Date()): string {
  return date.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
}

// UTC offset (in minutes) that the business time zone has at the given instant.
function tzOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - date.getTime()) / 60_000)
}

/*
  Start (inclusive) and end (exclusive) instants of the business-day containing
  `date`, plus the same for `daysAhead` days later when needed.
*/
export function businessDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const [y, m, d] = businessDateKey(date).split('-').map(Number)
  // Midnight local → guess with the current offset, then correct if DST differs at midnight.
  let start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetMinutes(date) * 60_000)
  const correction = tzOffsetMinutes(start) - tzOffsetMinutes(date)
  if (correction !== 0) start = new Date(start.getTime() - correction * 60_000)
  const end = new Date(start.getTime() + 24 * 3600_000)
  return { start, end }
}
