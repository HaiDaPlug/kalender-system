import type { Booking } from '@/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Väntande',   color: '#C4962A', bg: '#C4962A18' },
  confirmed:   { label: 'Bekräftad', color: '#4A90D9', bg: '#4A90D918' },
  in_progress: { label: 'Pågående',  color: '#8B5CF6', bg: '#8B5CF618' },
  completed:   { label: 'Klar',      color: '#3DAB6A', bg: '#3DAB6A18' },
  cancelled:   { label: 'Avbokad',   color: '#E05252', bg: '#E0525218' },
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
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ color: cfg.color, background: cfg.bg }}
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
