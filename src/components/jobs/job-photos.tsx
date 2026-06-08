'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Upload, Loader2, CheckCircle2, ImageIcon, X } from 'lucide-react'
import type { CleaningJob } from '@/types'
import { Lightbox } from '@/components/ui/lightbox'

interface Props {
  bookingId: string
  workerId: string
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
  const [error, setError] = useState<string | null>(null)
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
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, worker_id: workerId }),
    })
    if (!res.ok) {
      setError('Kunde inte starta jobbet')
      return null
    }
    const created = await res.json()
    setJob(created)
    return created.id
  }

  async function handleUpload(file: File, type: 'before' | 'after') {
    setError(null)
    setUploading(type)
    const jobId = await ensureJob()
    if (!jobId) { setUploading(null); return }

    const form = new FormData()
    form.append('file', file)
    form.append('type', type)

    const res = await fetch(`/api/jobs/${jobId}/images`, { method: 'POST', body: form })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Uppladdning misslyckades')
    } else {
      const img = await res.json()
      setImages(prev => [...prev, img])

      // Uppdatera status till in_progress om det är första before-bilden
      if (type === 'before' && job?.status === 'not_started') {
        await fetch(`/api/jobs/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' }),
        })
        setJob(prev => prev ? { ...prev, status: 'in_progress' } : prev)
      }
      // Markera needs_review om det finns before och vi laddar upp after
      if (type === 'after') {
        await fetch(`/api/jobs/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'needs_review' }),
        })
        setJob(prev => prev ? { ...prev, status: 'needs_review' } : prev)
      }
    }
    setUploading(null)
  }

  function onFileChange(type: 'before' | 'after') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleUpload(file, type)
      e.target.value = ''
    }
  }

  const beforeImages = images.filter(i => i.type === 'before')
  const afterImages  = images.filter(i => i.type === 'after')

  // Lightbox state — all images in one flat array for arrow navigation
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* FÖRE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="label-caps">Före tvätt</p>
          <button
            onClick={() => beforeRef.current?.click()}
            disabled={uploading !== null}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-secondary transition-colors disabled:opacity-40"
          >
            {uploading === 'before'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Camera className="h-3.5 w-3.5" />
            }
            Ta bild
          </button>
          <input
            ref={beforeRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange('before')}
          />
        </div>

        {beforeImages.length === 0 ? (
          <button
            onClick={() => beforeRef.current?.click()}
            disabled={uploading !== null}
            className="w-full border border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-40"
          >
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">Inga bilder ännu — tryck för att ta bild</span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {beforeImages.map(img => (
              <button
                key={img.id}
                onClick={() => setLightboxIndex(allImages.findIndex(a => a.id === img.id))}
                className="w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.public_url}
                  alt="Före"
                  className="w-full aspect-square object-cover rounded border border-border hover:opacity-90 transition-opacity"
                />
              </button>
            ))}
            <button
              onClick={() => beforeRef.current?.click()}
              disabled={uploading !== null}
              className="aspect-square rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-40"
            >
              {uploading === 'before'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Upload className="h-4 w-4" />
              }
            </button>
          </div>
        )}
      </div>

      {/* EFTER */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="label-caps">Efter tvätt</p>
          <button
            onClick={() => afterRef.current?.click()}
            disabled={uploading !== null || beforeImages.length === 0}
            title={beforeImages.length === 0 ? 'Ta bilder innan du lägger till efter-bilder' : undefined}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-secondary transition-colors disabled:opacity-40"
          >
            {uploading === 'after'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Camera className="h-3.5 w-3.5" />
            }
            Ta bild
          </button>
          <input
            ref={afterRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange('after')}
          />
        </div>

        {afterImages.length === 0 ? (
          <button
            onClick={() => afterRef.current?.click()}
            disabled={uploading !== null || beforeImages.length === 0}
            className="w-full border border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-40"
          >
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">
              {beforeImages.length === 0
                ? 'Ta före-bilder först'
                : 'Inga bilder ännu — tryck för att ta bild'}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {afterImages.map(img => (
              <button
                key={img.id}
                onClick={() => setLightboxIndex(allImages.findIndex(a => a.id === img.id))}
                className="w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.public_url}
                  alt="Efter"
                  className="w-full aspect-square object-cover rounded border border-border hover:opacity-90 transition-opacity"
                />
              </button>
            ))}
            <button
              onClick={() => afterRef.current?.click()}
              disabled={uploading !== null}
              className="aspect-square rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-40"
            >
              {uploading === 'after'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Upload className="h-4 w-4" />
              }
            </button>
          </div>
        )}
      </div>

      {/* Skicka in för granskning */}
      {afterImages.length > 0 && job?.status !== 'completed' && (
        <div className="flex items-center gap-2 pt-1 text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Bilder inskickade — Goran granskar jobbet
        </div>
      )}
      {job?.status === 'completed' && (
        <div className="pt-1 text-xs bg-primary/10 px-3 py-2 rounded space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Jobbet är godkänt
          </div>
          {job.admin_notes && (
            <p className="text-muted-foreground pl-5">
              <span className="font-medium text-foreground">Gorans kommentar: </span>
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
