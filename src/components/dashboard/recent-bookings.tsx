import type { Booking } from '@/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:     { label: 'Väntande',  className: 'text-status-pending bg-status-pending/10' },
  confirmed:   { label: 'Bekräftad', className: 'text-status-confirmed bg-status-confirmed/10' },
  in_progress: { label: 'Pågående',  className: 'text-status-in-progress bg-status-in-progress/10' },
  completed:   { label: 'Klar',      className: 'text-status-completed bg-status-completed/10' },
  cancelled:   { label: 'Avbokad',   className: 'text-status-cancelled bg-status-cancelled/10' },
}

export function RecentBookings({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="rounded border border-border bg-card animate-fade-up" style={{ animationDelay: '180ms' }}>
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <span className="label-caps">Senaste bokningar</span>
        <span className="label-caps">{bookings.length} poster</span>
      </div>

      {bookings.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">Inga bokningar ännu</p>
        </div>
      ) : (
        <ul>
          {bookings.map((booking, i) => {
            const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending
            return (
              <li
                key={booking.id}
                className="px-5 py-3 flex items-center justify-between gap-4 border-b border-border last:border-0 hover:bg-secondary/40 transition-colors cursor-default"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="label-caps w-5 text-right shrink-0 tabular opacity-40">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {booking.customer?.full_name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {booking.car?.make} {booking.car?.model} · {booking.service_type}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground tabular">
                    {format(new Date(booking.scheduled_at), 'dd MMM HH:mm', { locale: sv })}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${cfg.className}`}
                  >
                    {cfg.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
