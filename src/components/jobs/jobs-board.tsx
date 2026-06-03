import type { CleaningJob } from '@/types'
import { cn } from '@/lib/utils/cn'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

const COLUMNS = [
  {
    key: 'not_started',
    label: 'Ej påbörjat',
    color: '#6B6870',
    borderColor: '#2A2A30',
  },
  {
    key: 'in_progress',
    label: 'Pågående',
    color: '#8B5CF6',
    borderColor: '#8B5CF640',
  },
  {
    key: 'needs_review',
    label: 'Behöver granskning',
    color: '#C4962A',
    borderColor: '#C4962A40',
  },
  {
    key: 'completed',
    label: 'Klart',
    color: '#3DAB6A',
    borderColor: '#3DAB6A40',
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
            className="rounded border bg-card overflow-hidden animate-fade-up"
            style={{
              borderColor: col.borderColor,
              animationDelay: `${ci * 60}ms`,
            }}
          >
            {/* Column header */}
            <div
              className="px-3 py-2.5 border-b flex items-center justify-between"
              style={{ borderColor: col.borderColor }}
            >
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} />
                <span className="text-xs font-semibold" style={{ color: col.color }}>
                  {col.label}
                </span>
              </div>
              <span
                className="text-xs tabular font-medium px-1.5 py-0.5 rounded"
                style={{ color: col.color, background: `${col.color}18` }}
              >
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
                <div
                  key={job.id}
                  className="rounded border border-border bg-secondary/30 p-3 space-y-2 hover:bg-secondary/60 transition-colors cursor-default"
                >
                  <p className="text-sm font-medium text-foreground truncate leading-tight">
                    {(job.booking as any)?.customer?.full_name ?? 'Okänd kund'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(job.booking as any)?.car?.make} {(job.booking as any)?.car?.model}
                  </p>

                  <div className="pt-1 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/70">
                      {(job.worker as any)?.full_name ?? '—'}
                    </span>
                    {job.started_at && (
                      <span className="label-caps tabular">
                        {format(new Date(job.started_at), 'HH:mm', { locale: sv })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
