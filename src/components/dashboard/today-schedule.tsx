import Link from 'next/link'
import { CalendarDays, ArrowRight, Plus } from 'lucide-react'
import type { Booking } from '@/types'
import { BUSINESS_TZ } from '@/lib/time'
import { StatusBadge } from '@/components/ui/status-badge'

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ })
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function TodaySchedule({ bookings, dateLabel }: { bookings: Booking[]; dateLabel: string }) {
  return (
    <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: '120ms' }}>
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm font-semibold">Dagens schema</span>
          <span className="badge badge-outline badge-sm tabular">{bookings.length}</span>
          <span className="label-caps capitalize hidden sm:inline truncate">{dateLabel}</span>
        </div>
        <Link href="/calendar" className="btn btn-ghost btn-xs">
          Kalender
          <ArrowRight />
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="empty py-10">
          <CalendarDays />
          <p className="empty-title">Inga bokningar idag</p>
          <p className="empty-text">Dagen är fri. Lägg in en ny bokning i kalendern.</p>
          <Link href="/calendar?new=1" className="btn btn-secondary btn-sm mt-2">
            <Plus />
            Ny bokning
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {bookings.map(b => (
            <li key={b.id}>
              <Link
                href={`/bookings/${b.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="w-14 shrink-0">
                  <p className="text-sm font-semibold tabular leading-tight">{timeOf(b.scheduled_at)}</p>
                  <p className="text-[11px] text-muted-foreground tabular mt-0.5">{durationLabel(b.estimated_duration_minutes)}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.customer?.full_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.car ? `${b.car.make} ${b.car.model}` : '—'}
                    {b.car?.license_plate && <span className="plate ml-1.5 text-primary/90">{b.car.license_plate}</span>}
                    <span className="mx-1.5 opacity-50">·</span>
                    {b.service_type}
                  </p>
                </div>

                {b.assigned_worker && (
                  <div className="hidden md:flex items-center gap-2 shrink-0 max-w-[10rem]">
                    <div className="avatar avatar-sm">{b.assigned_worker.full_name.charAt(0)}</div>
                    <span className="text-xs text-muted-foreground truncate">{b.assigned_worker.full_name}</span>
                  </div>
                )}

                <StatusBadge status={b.status} size="sm" className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
