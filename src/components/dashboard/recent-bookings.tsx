import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import type { Booking } from '@/types'
import { BUSINESS_TZ } from '@/lib/time'
import { StatusBadge } from '@/components/ui/status-badge'

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ,
  })
}

export function RecentBookings({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: '180ms' }}>
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold">Senast inlagda</span>
        <span className="label-caps">{bookings.length} st</span>
      </div>

      {bookings.length === 0 ? (
        <div className="empty py-10">
          <Inbox />
          <p className="empty-title">Inga bokningar ännu</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {bookings.map(booking => (
            <li key={booking.id}>
              <Link
                href={`/bookings/${booking.id}`}
                className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {booking.customer?.full_name ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {whenLabel(booking.scheduled_at)}
                    <span className="mx-1.5 opacity-50">·</span>
                    {booking.service_type}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    Inlagd {formatDistanceToNow(new Date(booking.created_at), { locale: sv, addSuffix: true })}
                    {booking.creator && ` av ${booking.creator.full_name}`}
                  </p>
                </div>
                <StatusBadge status={booking.status} size="sm" className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
