import type { Booking } from '@/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Väntande',  color: '#C4962A', bg: '#C4962A18' },
  confirmed:   { label: 'Bekräftad',color: '#4A90D9', bg: '#4A90D918' },
  in_progress: { label: 'Pågående', color: '#8B5CF6', bg: '#8B5CF618' },
  completed:   { label: 'Klar',     color: '#3DAB6A', bg: '#3DAB6A18' },
  cancelled:   { label: 'Avbokad',  color: '#E05252', bg: '#E0525218' },
}

export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      {/* Table head */}
      <div className="grid border-b border-border px-5 py-2.5" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto' }}>
        {['Kund', 'Bil', 'Tjänst', 'Tidpunkt', 'Ansvarig', 'Status'].map(h => (
          <span key={h} className="label-caps">{h}</span>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="text-sm text-muted-foreground">Inga bokningar hittades</p>
        </div>
      ) : (
        <ul>
          {bookings.map((b, i) => {
            const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending
            return (
              <li
                key={b.id}
                className="grid border-b border-border last:border-0 px-5 py-3 items-center hover:bg-secondary/40 transition-colors cursor-default animate-fade-up"
                style={{
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto',
                  animationDelay: `${i * 30}ms`,
                }}
              >
                <span className="text-sm font-medium text-foreground truncate pr-4">
                  {b.customer?.full_name ?? '—'}
                </span>
                <span className="text-sm text-muted-foreground truncate pr-4">
                  {b.car ? `${b.car.make} ${b.car.model}` : '—'}
                </span>
                <span className="text-sm text-muted-foreground truncate pr-4">
                  {b.service_type}
                </span>
                <span className="text-sm text-muted-foreground tabular pr-4">
                  {format(new Date(b.scheduled_at), 'dd MMM, HH:mm', { locale: sv })}
                </span>
                <span className="text-sm text-muted-foreground truncate pr-4">
                  {b.assigned_worker?.full_name ?? (
                    <span className="text-muted-foreground/50 italic">Ej tilldelad</span>
                  )}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap"
                  style={{ color: cfg.color, background: cfg.bg }}
                >
                  {cfg.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
