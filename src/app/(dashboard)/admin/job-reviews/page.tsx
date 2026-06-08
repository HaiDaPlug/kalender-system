'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp, Car, User } from 'lucide-react'
import type { CleaningJob } from '@/types'
import { cn } from '@/lib/utils/cn'
import { Lightbox } from '@/components/ui/lightbox'

const STATUS_CONFIG = {
  not_started:  { label: 'Ej påbörjat',       color: '#6B6870' },
  in_progress:  { label: 'Pågående',           color: '#8B5CF6' },
  needs_review: { label: 'Väntar granskning',  color: '#C4962A' },
  completed:    { label: 'Klart',              color: '#3DAB6A' },
}

interface JobWithImages extends CleaningJob {
  images: { id: string; public_url: string; type: 'before' | 'after'; created_at: string }[]
}

function PhotoGrid({ images, type, onOpen }: {
  images: JobWithImages['images']
  type: 'before' | 'after'
  onOpen: (index: number) => void
}) {
  const filtered = images.filter(i => i.type === type)
  if (filtered.length === 0) {
    return <p className="text-xs text-muted-foreground/50 italic">Inga bilder</p>
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {filtered.map((img, i) => (
        <button key={img.id} onClick={() => onOpen(i)} className="w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.public_url}
            alt={type === 'before' ? 'Före' : 'Efter'}
            className="w-full aspect-square object-cover rounded border border-border hover:opacity-90 transition-opacity"
          />
        </button>
      ))}
    </div>
  )
}

function JobCard({ job, onMarkDone }: { job: JobWithImages; onMarkDone: (id: string, patch: Partial<JobWithImages>) => void }) {
  const [expanded, setExpanded] = useState(job.status === 'needs_review')
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminComment, setAdminComment] = useState(job.admin_notes ?? '')
  const [lightbox, setLightbox] = useState<{ images: { url: string; alt: string }[]; index: number } | null>(null)
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.not_started

  function openLightbox(type: 'before' | 'after', indexInGroup: number) {
    const all = job.images.map(i => ({ url: i.public_url, alt: i.type === 'before' ? 'Före' : 'Efter' }))
    const grouped = job.images.filter(i => i.type === type)
    const clickedUrl = grouped[indexInGroup]?.public_url
    const globalIndex = all.findIndex(i => i.url === clickedUrl)
    setLightbox({ images: all, index: globalIndex >= 0 ? globalIndex : 0 })
  }

  async function handleMarkDone() {
    setMarking(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', admin_notes: adminComment.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Kunde inte spara — försök igen')
        return
      }
      // Pass the full API response so parent can update all fields (status, admin_notes, completed_at)
      const updated = await res.json()
      onMarkDone(job.id, updated)
    } catch {
      setError('Nätverksfel — kontrollera anslutningen')
    } finally {
      setMarking(false)
    }
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
              <PhotoGrid images={job.images} type="before" onOpen={i => openLightbox('before', i)} />
            </div>
            <div className="space-y-2">
              <p className="label-caps text-muted-foreground">Efter</p>
              <PhotoGrid images={job.images} type="after" onOpen={i => openLightbox('after', i)} />
            </div>
          </div>

          {job.worker_notes && (
            <div className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded">
              <span className="font-medium">Teknikerens notering: </span>
              {job.worker_notes}
            </div>
          )}

          {job.status === 'needs_review' && (
            <div className="space-y-2">
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</p>
              )}
              <textarea
                value={adminComment}
                onChange={e => setAdminComment(e.target.value)}
                rows={2}
                placeholder="Kommentar till teknikern (valfritt). T.ex. Bra jobbat eller Tvätta dörrhandtagen nästa gång"
                className="w-full px-3 py-2 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 resize-none"
              />
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
            </div>
          )}
          {job.status === 'completed' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Godkänt{job.completed_at ? ` · ${format(new Date(job.completed_at), 'dd MMM HH:mm', { locale: sv })}` : ''}
              </div>
              {job.admin_notes && (
                <div className="text-xs text-muted-foreground bg-secondary/40 px-3 py-2 rounded">
                  <span className="font-medium">Din kommentar: </span>{job.admin_notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={i => setLightbox(prev => prev ? { ...prev, index: i } : null)}
        />
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
      const data: JobWithImages[] = await res.json()
      // Newest first — use started_at, fall back to created_at
      data.sort((a, b) =>
        new Date(b.started_at ?? b.created_at).getTime() -
        new Date(a.started_at ?? a.created_at).getTime()
      )
      setJobs(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { (async () => { await fetchJobs() })() }, [fetchJobs])

  function handleMarkDone(jobId: string, patch: Partial<JobWithImages>) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j))
  }

  const filtered = jobs.filter(j => {
    if (filter === 'all') return true
    if (filter === 'needs_review') return j.status === 'needs_review'
    return j.status === 'completed'
  })

  const needsReviewCount = jobs.filter(j => j.status === 'needs_review').length

  // Group jobs by date label: Today / Yesterday / older dates
  const grouped = filtered.reduce<{ label: string; jobs: JobWithImages[] }[]>((acc, job) => {
    const date = new Date(job.started_at ?? job.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    let label: string
    if (date.toDateString() === today.toDateString()) {
      label = 'Idag'
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = 'Igår'
    } else {
      label = format(date, 'd MMMM yyyy', { locale: sv })
    }

    const existing = acc.find(g => g.label === label)
    if (existing) {
      existing.jobs.push(job)
    } else {
      acc.push({ label, jobs: [job] })
    }
    return acc
  }, [])

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
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.label} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                {group.label}
              </p>
              {group.jobs.map(job => (
                <JobCard key={job.id} job={job} onMarkDone={handleMarkDone} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
