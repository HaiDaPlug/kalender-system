import Link from 'next/link'
import type { CleaningJob } from '@/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

const COLUMNS = [
  {
    key: 'not_started',
    label: 'Ej påbörjat',
    textClass: 'text-status-not-started',
    bgClass: 'bg-status-not-started',
    chipClass: 'bg-status-not-started/10',
    borderClass: 'border-border',
  },
  {
    key: 'in_progress',
    label: 'Pågående',
    textClass: 'text-status-in-progress',
    bgClass: 'bg-status-in-progress',
    chipClass: 'bg-status-in-progress/10',
    borderClass: 'border-status-in-progress/25',
  },
  {
    key: 'needs_review',
    label: 'Behöver granskning',
    textClass: 'text-status-pending',
    bgClass: 'bg-status-pending',
    chipClass: 'bg-status-pending/10',
    borderClass: 'border-status-pending/25',
  },
  {
    key: 'completed',
    label: 'Klart',
    textClass: 'text-status-completed',
    bgClass: 'bg-status-completed',
    chipClass: 'bg-status-completed/10',
    borderClass: 'border-status-completed/25',
  },
] as const

export function JobsBoard({ jobs }: { jobs: CleaningJob[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
      {COLUMNS.map((col, ci) => {
        const colJobs = jobs.filter(j => j.status === col.key)
        return (
          <div
            key={col.key}
            className={`rounded border bg-card overflow-hidden animate-fade-up ${col.borderClass}`}
            style={{ animationDelay: `${ci * 60}ms` }}
          >
            {/* Column header */}
            <div className={`px-3 py-2.5 border-b flex items-center justify-between ${col.borderClass}`}>
              <div className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${col.bgClass}`} />
                <span className={`text-xs font-semibold ${col.textClass}`}>
                  {col.label}
                </span>
              </div>
              <span className={`text-xs tabular font-medium px-1.5 py-0.5 rounded ${col.textClass} ${col.chipClass}`}>
                {colJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2">
              {colJobs.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground/50">Inga jobb</p>
                </div>
              )}
              {colJobs.map(job => (
                <Link
                  key={job.id}
                  href={`/bookings/${job.booking_id}`}
                  className="block rounded border border-border bg-secondary/30 p-3 space-y-2 hover:bg-secondary/60 hover:border-primary/30 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground truncate leading-tight">
                    {job.booking?.customer?.full_name ?? 'Okänd kund'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.booking?.car?.make} {job.booking?.car?.model}
                  </p>

                  <div className="pt-1 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/70">
                      {job.worker?.full_name ?? '—'}
                    </span>
                    {job.started_at && (
                      <span className="label-caps tabular">
                        {format(new Date(job.started_at), 'HH:mm', { locale: sv })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
