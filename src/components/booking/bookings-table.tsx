import Link from 'next/link'
import { Inbox } from 'lucide-react'
import type { Booking } from '@/types'
import { BUSINESS_TZ } from '@/lib/time'
import { StatusBadge } from '@/components/ui/status-badge'

const COLUMNS = '1.3fr 1.2fr 1fr 0.9fr 1fr auto'

function when(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ,
  })
}

export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="card overflow-hidden">
      {/* Table head */}
      <div className="grid border-b border-border px-5 py-2.5 gap-4" style={{ gridTemplateColumns: COLUMNS }}>
        {['Kund', 'Bil', 'Tjänst', 'Tidpunkt', 'Ansvarig', 'Status'].map(h => (
          <span key={h} className="label-caps">{h}</span>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="empty py-14">
          <Inbox />
          <p className="empty-title">Inga bokningar hittades</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {bookings.map((b, i) => (
            <li key={b.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <Link
                href={`/bookings/${b.id}`}
                className="grid px-5 py-3 gap-4 items-center hover:bg-secondary/50 transition-colors"
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span className="text-sm font-medium text-foreground truncate">
                  {b.customer?.full_name ?? '—'}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {b.car ? `${b.car.make} ${b.car.model}` : '—'}
                  {b.car?.license_plate && <span className="plate ml-1.5 text-primary/90 text-xs">{b.car.license_plate}</span>}
                </span>
                <span className="text-sm text-muted-foreground truncate">{b.service_type}</span>
                <span className="text-sm text-muted-foreground tabular">{when(b.scheduled_at)}</span>
                <span className="text-sm text-muted-foreground truncate">
                  {b.assigned_worker?.full_name ?? <span className="text-muted-foreground/50 italic">Ej tilldelad</span>}
                </span>
                <StatusBadge status={b.status} size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
