'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp, Car, User } from 'lucide-react'
import type { CleaningJob } from '@/types'
import { cn } from '@/lib/utils/cn'

const STATUS_CONFIG = {
  not_started:  { label: 'Ej påbörjat',       color: '#6B6870' },
  in_progress:  { label: 'Pågående',           color: '#8B5CF6' },
  needs_review: { label: 'Väntar granskning',  color: '#C4962A' },
  completed:    { label: 'Klart',              color: '#3DAB6A' },
}

interface JobWithImages extends CleaningJob {
  images: { id: string; public_url: string; type: 'before' | 'after'; created_at: string }[]
}

function PhotoGrid({ images, type }: { images: JobWithImages['images']; type: 'before' | 'after' }) {
  const filtered = images.filter(i => i.type === type)
  if (filtered.length === 0) {
    return <p className="text-xs text-muted-foreground/50 italic">Inga bilder</p>
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {filtered.map(img => (
        <a key={img.id} href={img.public_url} target="_blank" rel="noopener noreferrer">
          <img
            src={img.public_url}
            alt={type === 'before' ? 'Före' : 'Efter'}
            className="w-full aspect-square object-cover rounded border border-border hover:opacity-90 transition-opacity"
          />
        </a>
      ))}
    </div>
  )
}

function JobCard({ job, onMarkDone }: { job: JobWithImages; onMarkDone: (id: string) => void }) {
  const [expanded, setExpanded] = useState(job.status === 'needs_review')
  const [marking, setMarking] = useState(false)
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.not_started

  async function handleMarkDone() {
    setMarking(true)
    await fetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    onMarkDone(job.id)
    setMarking(false)
  }

  return (
    <div
      className={cn(
        'rounded border bg-card overflow-hidden transition-all',
        job.status === 'needs_review' ? 'border-yellow-500/40' : 'border-border'
      )}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: cfg.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {job.booking?.customer?.full_name ?? 'Okänd kund'}
            </span>
            {job.booking?.car && (
              <span className="text-xs text-muted-foreground">
                {job.booking.car.make} {job.booking.car.model}
                {job.booking.car.license_plate && (
                  <span className="ml-1 font-mono tracking-widest uppercase text-primary">
                    {job.booking.car.license_plate}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
            {job.started_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(job.started_at), 'HH:mm', { locale: sv })}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {job.worker?.full_name ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              {job.images.filter(i => i.type === 'before').length} före ·{' '}
              {job.images.filter(i => i.type === 'after').length} efter
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded: bilder sida vid sida */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="label-caps text-muted-foreground">Före</p>
              <PhotoGrid images={job.images} type="before" />
            </div>
            <div className="space-y-2">
              <p className="label-caps text-muted-foreground">Efter</p>
              <PhotoGrid images={job.images} type="after" />
            </div>
          </div>

          {job.worker_notes && (
            <div className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded">
              <span className="font-medium">Teknikerens notering: </span>
              {job.worker_notes}
            </div>
          )}

          {job.status === 'needs_review' && (
            <button
              onClick={handleMarkDone}
              disabled={marking}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
            >
              {marking
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />
              }
              Godkänn jobbet
            </button>
          )}
          {job.status === 'completed' && (
            <div className="flex items-center gap-2 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Godkänt{job.completed_at ? ` · ${format(new Date(job.completed_at), 'dd MMM HH:mm', { locale: sv })}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function JobReviewsPage() {
  const [jobs, setJobs] = useState<JobWithImages[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'needs_review' | 'completed'>('needs_review')

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    if (res.ok) {
      const data = await res.json()
      setJobs(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  function handleMarkDone(jobId: string) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed' as const } : j))
  }

  const filtered = jobs.filter(j => {
    if (filter === 'all') return true
    if (filter === 'needs_review') return j.status === 'needs_review'
    return j.status === 'completed'
  })

  const needsReviewCount = jobs.filter(j => j.status === 'needs_review').length

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          Jobbgranskning
          {needsReviewCount > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
              {needsReviewCount} väntar
            </span>
          )}
        </h1>
        <p className="text-muted-foreground text-sm">Granska före/efter-bilder från dina tekniker</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {([
          ['needs_review', 'Väntar granskning'],
          ['all',          'Alla jobb'],
          ['completed',    'Klara'],
        ] as const).map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={cn(
              'px-3 py-1.5 text-xs rounded border transition-colors',
              filter === val
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar jobb…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Car className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === 'needs_review' ? 'Inga jobb väntar granskning' : 'Inga jobb hittades'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => (
            <JobCard key={job.id} job={job} onMarkDone={handleMarkDone} />
          ))}
        </div>
      )}
    </div>
  )
}
