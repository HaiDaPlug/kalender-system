'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import Link from 'next/link'
import { Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp, Car, User, ArrowUpRight, ScanEye } from 'lucide-react'
import { toast } from 'sonner'
import type { CleaningJob } from '@/types'
import { cn } from '@/lib/utils/cn'
import { Lightbox } from '@/components/ui/lightbox'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'

interface JobWithImages extends CleaningJob {
  images: { id: string; public_url: string; type: 'before' | 'after'; created_at: string }[]
}

type Filter = 'needs_review' | 'all' | 'completed'

function PhotoGrid({ images, type, onOpen }: {
  images: JobWithImages['images']
  type: 'before' | 'after'
  onOpen: (index: number) => void
}) {
  const filtered = images.filter(i => i.type === type)
  if (filtered.length === 0) {
    return <p className="text-xs text-muted-foreground/60 italic">Inga bilder</p>
  }
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {filtered.map((img, i) => (
        <button key={img.id} onClick={() => onOpen(i)} className="w-full rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.public_url}
            alt={type === 'before' ? 'Före' : 'Efter'}
            loading="lazy"
            decoding="async"
            className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
          />
        </button>
      ))}
    </div>
  )
}

function JobCard({ job, onMarkDone }: { job: JobWithImages; onMarkDone: (id: string, patch: Partial<JobWithImages>) => void }) {
  const [expanded, setExpanded] = useState(job.status === 'needs_review')
  const [marking, setMarking] = useState(false)
  const [adminComment, setAdminComment] = useState(job.admin_notes ?? '')
  const [lightbox, setLightbox] = useState<{ images: { url: string; alt: string }[]; index: number } | null>(null)

  const beforeCount = job.images.filter(i => i.type === 'before').length
  const afterCount  = job.images.filter(i => i.type === 'after').length

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
        toast.error('Kunde inte godkänna jobbet', { description: d.error ?? `${res.status} ${res.statusText}` })
        return
      }
      const updated = await res.json()
      onMarkDone(job.id, updated)
      toast.success('Jobbet godkändes')
    } catch (err) {
      toast.error('Kunde inte godkänna jobbet', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className={cn('card overflow-hidden transition-colors', job.status === 'needs_review' && 'border-status-pending/45')}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              {job.booking?.customer?.full_name ?? 'Okänd kund'}
            </span>
            {job.booking?.car && (
              <span className="text-xs text-muted-foreground">
                {job.booking.car.make} {job.booking.car.model}
                {job.booking.car.license_plate && <span className="plate ml-1.5 text-primary/90">{job.booking.car.license_plate}</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <StatusBadge status={job.status} kind="job" size="sm" />
            {job.started_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 tabular">
                <Clock className="h-3 w-3" />
                {format(new Date(job.started_at), 'HH:mm', { locale: sv })}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {job.worker?.full_name ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground tabular">
              {beforeCount} före · {afterCount} efter
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="label-caps">Före</p>
              <PhotoGrid images={job.images} type="before" onOpen={i => openLightbox('before', i)} />
            </div>
            <div className="space-y-2">
              <p className="label-caps">Efter</p>
              <PhotoGrid images={job.images} type="after" onOpen={i => openLightbox('after', i)} />
            </div>
          </div>

          {job.worker_notes && (
            <div className="text-xs text-muted-foreground bg-secondary/50 border border-border px-3 py-2 rounded-md">
              <span className="font-medium text-foreground">Personalens notering: </span>
              {job.worker_notes}
            </div>
          )}

          {job.status === 'needs_review' && (
            <div className="space-y-2">
              <textarea
                value={adminComment}
                onChange={e => setAdminComment(e.target.value)}
                rows={2}
                placeholder="Kommentar till personalen (valfritt) — t.ex. Bra jobbat, eller Tvätta dörrhandtagen nästa gång"
                className="field"
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {job.booking?.id && (
                  <Link href={`/bookings/${job.booking.id}`} className="btn btn-ghost btn-sm">
                    Öppna bokning
                    <ArrowUpRight />
                  </Link>
                )}
                <button onClick={handleMarkDone} disabled={marking} className="btn btn-primary btn-sm ml-auto">
                  {marking ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Godkänn jobbet
                </button>
              </div>
            </div>
          )}
          {job.status === 'completed' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-status-completed font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Godkänt{job.completed_at ? ` · ${format(new Date(job.completed_at), 'd MMM HH:mm', { locale: sv })}` : ''}
              </div>
              {job.admin_notes && (
                <div className="text-xs text-muted-foreground bg-secondary/50 border border-border px-3 py-2 rounded-md">
                  <span className="font-medium text-foreground">Din kommentar: </span>{job.admin_notes}
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
  const [filter, setFilter] = useState<Filter>('needs_review')

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    if (res.ok) {
      const data: JobWithImages[] = await res.json()
      data.sort((a, b) =>
        new Date(b.started_at ?? b.created_at).getTime() -
        new Date(a.started_at ?? a.created_at).getTime()
      )
      setJobs(data)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error('Kunde inte hämta jobb', { description: d.error ?? `${res.status} ${res.statusText}` })
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

  // Group by date label: Today / Yesterday / older dates
  const grouped = filtered.reduce<{ label: string; jobs: JobWithImages[] }[]>((acc, job) => {
    const date = new Date(job.started_at ?? job.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    let label: string
    if (date.toDateString() === today.toDateString()) label = 'Idag'
    else if (date.toDateString() === yesterday.toDateString()) label = 'Igår'
    else label = format(date, 'd MMMM yyyy', { locale: sv })

    const existing = acc.find(g => g.label === label)
    if (existing) existing.jobs.push(job)
    else acc.push({ label, jobs: [job] })
    return acc
  }, [])

  const FILTERS: [Filter, string][] = [
    ['needs_review', 'Väntar granskning'],
    ['all',          'Alla jobb'],
    ['completed',    'Godkända'],
  ]

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title={
          <>
            Jobbgranskning
            {needsReviewCount > 0 && (
              <span className="badge badge-status" style={{ '--badge-color': 'var(--status-pending)' } as React.CSSProperties}>
                {needsReviewCount} väntar
              </span>
            )}
          </>
        }
        subtitle="Granska före- och efterbilder från personalen"
        actions={
          <div className="segmented">
            {FILTERS.map(([val, lbl]) => (
              <button key={val} data-active={filter === val} onClick={() => setFilter(val)}>{lbl}</button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar jobb…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty py-14">
          {filter === 'needs_review' ? <ScanEye /> : <Car />}
          <p className="empty-title">{filter === 'needs_review' ? 'Inget väntar på granskning' : 'Inga jobb hittades'}</p>
          <p className="empty-text">{filter === 'needs_review' ? 'Nya jobb dyker upp här när personalen laddat upp efterbilder.' : 'Prova ett annat filter.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.label} className="space-y-2">
              <p className="label-caps px-0.5">{group.label}</p>
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
