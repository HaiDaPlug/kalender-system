'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Upload, Loader2, CheckCircle2, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { CleaningJob } from '@/types'
import { Lightbox } from '@/components/ui/lightbox'
import { StatusBadge } from '@/components/ui/status-badge'

interface Props {
  bookingId: string
  workerId?: string | null
}

interface UploadedImage {
  id: string
  public_url: string
  type: 'before' | 'after'
  created_at: string
}

export function JobPhotos({ bookingId, workerId }: Props) {
  const [job, setJob] = useState<CleaningJob | null>(null)
  const [images, setImages] = useState<UploadedImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null)
  const beforeRef = useRef<HTMLInputElement>(null)
  const afterRef = useRef<HTMLInputElement>(null)

  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/jobs?booking_id=${bookingId}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    const found = Array.isArray(data) ? data.find((j: CleaningJob) => j.booking_id === bookingId) : null
    if (found) {
      setJob(found)
      setImages((found.images ?? []) as UploadedImage[])
    }
    setLoading(false)
  }, [bookingId])

  useEffect(() => { (async () => { await fetchJob() })() }, [fetchJob])

  async function ensureJob(): Promise<string | null> {
    if (job) return job.id
    // The server picks the worker: the caller themselves for staff, the
    // booking's assigned worker (or the given id) for admin/manager.
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, worker_id: workerId ?? undefined }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error('Kunde inte starta jobbet', { description: d.error ?? `${res.status} ${res.statusText}` })
      return null
    }
    const created = await res.json()
    setJob(created)
    if (Array.isArray(created.images)) setImages(created.images)
    return created.id
  }

  async function patchStatus(jobId: string, status: CleaningJob['status']) {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setJob(prev => prev ? { ...prev, ...updated } : prev)
    }
  }

  async function handleUpload(file: File, type: 'before' | 'after') {
    setUploading(type)
    try {
      const jobId = await ensureJob()
      if (!jobId) return

      const form = new FormData()
      form.append('file', file)
      form.append('type', type)

      const res = await fetch(`/api/jobs/${jobId}/images`, { method: 'POST', body: form })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error('Uppladdning misslyckades', { description: d.error ?? `${res.status} ${res.statusText}` })
        return
      }
      const img = await res.json()
      setImages(prev => [...prev, img])

      // First before-photo starts the job; any after-photo sends it for review.
      if (type === 'before' && (!job || job.status === 'not_started')) {
        await patchStatus(jobId, 'in_progress')
      }
      if (type === 'after' && job?.status !== 'completed') {
        await patchStatus(jobId, 'needs_review')
      }
    } catch (err) {
      toast.error('Uppladdning misslyckades', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    } finally {
      setUploading(null)
    }
  }

  function onFileChange(type: 'before' | 'after') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleUpload(file, type)
      e.target.value = ''
    }
  }

  const beforeImages = images.filter(i => i.type === 'before')
  const afterImages  = images.filter(i => i.type === 'after')

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const allImages = [...beforeImages, ...afterImages]

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Laddar bilder…</span>
      </div>
    )
  }

  const locked = job?.status === 'completed'

  const renderPhase = (
    phase: 'before' | 'after',
    label: string,
    phaseImages: UploadedImage[],
    inputRef: React.RefObject<HTMLInputElement | null>,
    disabled: boolean,
    emptyText: string,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {label}
          <span className="ml-1.5 text-xs text-muted-foreground tabular">{phaseImages.length}</span>
        </p>
        {!locked && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading !== null || disabled}
            title={disabled ? 'Ta före-bilder först' : undefined}
            className="btn btn-secondary btn-xs"
          >
            {uploading === phase ? <Loader2 className="animate-spin" /> : <Camera />}
            Ta bild
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange(phase)} />
      </div>

      {phaseImages.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading !== null || disabled || locked}
          className="w-full border border-dashed border-border-strong rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/5 transition-colors disabled:opacity-40"
        >
          {uploading === phase ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
          <span className="text-xs">{emptyText}</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {phaseImages.map(img => (
            <button
              key={img.id}
              onClick={() => setLightboxIndex(allImages.findIndex(a => a.id === img.id))}
              className="w-full rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.public_url} alt={label} loading="lazy" decoding="async" className="w-full aspect-square object-cover hover:opacity-90 transition-opacity" />
            </button>
          ))}
          {!locked && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading !== null}
              aria-label="Lägg till bild"
              className="aspect-square rounded-md border border-dashed border-border-strong flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/5 transition-colors disabled:opacity-40"
            >
              {uploading === phase ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {job && (
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} kind="job" size="sm" />
          {job.worker && <span className="text-xs text-muted-foreground">Utförs av {job.worker.full_name}</span>}
        </div>
      )}

      {renderPhase('before', 'Före tvätt', beforeImages, beforeRef, false, 'Inga bilder ännu — tryck för att ta bild')}
      {renderPhase('after', 'Efter tvätt', afterImages, afterRef, beforeImages.length === 0,
        beforeImages.length === 0 ? 'Ta före-bilder först' : 'Inga bilder ännu — tryck för att ta bild')}

      {afterImages.length > 0 && job?.status === 'needs_review' && (
        <div className="flex items-center gap-2 text-xs text-status-pending bg-status-pending/10 border border-status-pending/25 px-3 py-2 rounded-md">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Bilder inskickade — väntar på granskning
        </div>
      )}
      {job?.status === 'completed' && (
        <div className="text-xs bg-status-completed/10 border border-status-completed/25 px-3 py-2 rounded-md space-y-1">
          <div className="flex items-center gap-2 text-status-completed font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Jobbet är godkänt
          </div>
          {job.admin_notes && (
            <p className="text-muted-foreground pl-5">
              <span className="font-medium text-foreground">Kommentar: </span>
              {job.admin_notes}
            </p>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={allImages.map(i => ({ url: i.public_url, alt: i.type === 'before' ? 'Före' : 'Efter' }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  )
}
