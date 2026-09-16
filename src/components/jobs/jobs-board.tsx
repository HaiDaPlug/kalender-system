import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { CleaningJob, CleaningJobStatus } from '@/types'
import { JOB_STATUS } from '@/lib/status'
import { BUSINESS_TZ } from '@/lib/time'

const COLUMN_ORDER: CleaningJobStatus[] = ['not_started', 'in_progress', 'needs_review', 'completed']

export function JobsBoard({ jobs }: { jobs: CleaningJob[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
      {COLUMN_ORDER.map((key, ci) => {
        const meta = JOB_STATUS[key]
        const colJobs = jobs.filter(j => j.status === key)
        const tinted = key !== 'not_started'
        return (
          <div
            key={key}
            className={`card overflow-hidden animate-fade-up ${tinted ? 'card-tinted' : ''}`}
            style={{ animationDelay: `${ci * 60}ms`, '--tint': meta.color } as CSSProperties}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <span
                className="text-xs tabular font-semibold px-1.5 py-0.5 rounded-sm"
                style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
              >
                {colJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2">
              {colJobs.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground/60">Inga jobb</p>
                </div>
              )}
              {colJobs.map(job => (
                <Link
                  key={job.id}
                  href={`/bookings/${job.booking_id}`}
                  className="block rounded-md border border-border bg-background/60 p-3 space-y-1.5 hover:bg-secondary hover:border-border-strong transition-colors"
                >
                  <p className="text-sm font-medium text-foreground truncate leading-tight">
                    {job.booking?.customer?.full_name ?? 'Okänd kund'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {job.booking?.car ? `${job.booking.car.make} ${job.booking.car.model}` : '—'}
                    {job.booking?.car?.license_plate && <span className="plate ml-1.5 text-primary/90">{job.booking.car.license_plate}</span>}
                  </p>

                  <div className="pt-1.5 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      {job.worker?.full_name ?? '—'}
                    </span>
                    {job.started_at && (
                      <span className="label-caps tabular shrink-0">
                        {new Date(job.started_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ })}
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
