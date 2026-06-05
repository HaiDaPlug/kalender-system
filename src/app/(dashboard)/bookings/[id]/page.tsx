'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Car, User, Phone, Clock, Wrench,
  MessageSquare, Loader2, Trash2, CheckCircle2, Save, History
} from 'lucide-react'
import type { Booking, BookingStatus } from '@/types'
import { cn } from '@/lib/utils/cn'

const STATUS_OPTIONS: { value: BookingStatus; label: string; color: string }[] = [
  { value: 'pending',     label: 'Väntar',      color: '#C4962A' },
  { value: 'confirmed',   label: 'Bekräftad',   color: '#4A90D9' },
  { value: 'in_progress', label: 'Pågår',       color: '#8B5CF6' },
  { value: 'completed',   label: 'Klar',        color: '#3DAB6A' },
  { value: 'cancelled',   label: 'Avbokad',     color: '#E05252' },
]

const SERVICES = [
  'Invändig städning', 'Utvändig tvätt', 'Hel rekond',
  'Polering', 'Lackskydd', 'Motortvättning', 'Övrigt',
]

function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function BookingDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [booking, setBooking]     = useState<Booking | null>(null)
  const workers: { id: string; full_name: string }[] = []
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Redigerbara fält
  const [status, setStatus]           = useState<BookingStatus>('confirmed')
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration]       = useState(60)
  const [service, setService]         = useState('')
  const [workerId, setWorkerId]       = useState('')
  const [price, setPrice]             = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [serviceNotes, setServiceNotes]   = useState('')

  const fetchBooking = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/bookings/${id}`)
    const data = await res.json()
    if (!res.ok) { setError('Bokning hittades inte'); setLoading(false); return }

    setBooking(data)
    setStatus(data.status)
    setScheduledAt(toLocalInputValue(data.scheduled_at))
    setDuration(data.estimated_duration_minutes)
    setService(data.service_type)
    setWorkerId(data.assigned_worker_id ?? '')
    setPrice(data.total_price?.toString() ?? '')
    setCustomerNotes(data.customer_notes ?? '')
    setServiceNotes(data.service_notes ?? '')
    setLoading(false)
  }, [id])

  useEffect(() => {
    (async () => { await fetchBooking() })()
  }, [fetchBooking])


  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        scheduled_at:                new Date(scheduledAt).toISOString(),
        estimated_duration_minutes:  duration,
        service_type:                service,
        assigned_worker_id:          workerId || null,
        total_price:                 price ? parseFloat(price) : null,
        customer_notes:              customerNotes || null,
        service_notes:               serviceNotes || null,
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Kunde inte spara')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await fetchBooking()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Ta bort bokningen? Det går inte att ångra.')) return
    setDeleting(true)
    await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
    router.push('/calendar')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !booking) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">
          Tillbaka
        </button>
      </div>
    )
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status)

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4 pb-8">
      {/* Tillbaka + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">
            {booking?.car?.make} {booking?.car?.model}
            {booking?.car?.license_plate && (
              <span className="ml-2 font-mono tracking-widest text-primary">
                {booking.car.license_plate}
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{booking?.customer?.full_name}</p>
        </div>
        {/* Statusbadge */}
        {currentStatus && (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ color: currentStatus.color, background: `${currentStatus.color}18` }}
          >
            {currentStatus.label}
          </span>
        )}
      </div>

      {/* Kund + bil — skrivskyddad info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="label-caps">Kund</p>
            {booking?.customer_id && (
              <Link
                href={`/customers/${booking.customer_id}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <History className="h-3 w-3" />
                Historik
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm">{booking?.customer?.full_name ?? '—'}</span>
          </div>
          {booking?.customer?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a
                href={`tel:${booking.customer.phone}`}
                className="text-sm tabular text-primary hover:underline"
              >
                {booking.customer.phone}
              </a>
            </div>
          )}
          {booking?.customer?.email && (
            <p className="text-xs text-muted-foreground truncate">{booking.customer.email}</p>
          )}
        </div>

        <div className="rounded border border-border bg-card p-4 space-y-2">
          <p className="label-caps">Bil</p>
          <div className="flex items-center gap-2">
            <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm">{booking?.car?.make} {booking?.car?.model}</span>
          </div>
          {booking?.car?.license_plate && (
            <p className="text-sm font-mono tracking-widest uppercase text-primary font-semibold">
              {booking.car.license_plate}
            </p>
          )}
          {booking?.car?.color && (
            <p className="text-xs text-muted-foreground">{booking.car.color}</p>
          )}
        </div>
      </div>

      {/* Redigerbara bokningsfält */}
      <div className="rounded border border-border bg-card p-4 space-y-4">
        <p className="label-caps">Bokning</p>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="label-caps text-muted-foreground">Status</label>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-all',
                  status === opt.value
                    ? 'ring-1'
                    : 'opacity-40 hover:opacity-70'
                )}
                style={{
                  color: opt.color,
                  background: `${opt.color}18`,
                  outline: status === opt.value ? `1px solid ${opt.color}` : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tid + längd */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="label-caps text-muted-foreground">Tid</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="label-caps text-muted-foreground">Längd</label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[30, 60, 90, 120, 180, 240].map(d => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} tim`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tjänst + tekniker */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="label-caps text-muted-foreground">Tjänst</label>
            <select
              value={service}
              onChange={e => setService(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="label-caps text-muted-foreground">Tekniker</label>
            <select
              value={workerId}
              onChange={e => setWorkerId(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Ingen tilldelad</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pris */}
        <div className="space-y-1.5">
          <label className="label-caps text-muted-foreground">Pris (kr)</label>
          <div className="relative">
            <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="number"
              placeholder="0"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Anteckningar */}
      <div className="rounded border border-border bg-card p-4 space-y-4">
        <p className="label-caps">Anteckningar</p>

        <div className="space-y-1.5">
          <label className="label-caps text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" />
            Kundönskemål
          </label>
          <textarea
            value={customerNotes}
            onChange={e => setCustomerNotes(e.target.value)}
            rows={2}
            placeholder="Inga önskemål angivna…"
            className="w-full px-3 py-2 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="label-caps text-muted-foreground flex items-center gap-1.5">
            <Wrench className="h-3 w-3" />
            Interna anteckningar
          </label>
          <textarea
            value={serviceNotes}
            onChange={e => setServiceNotes(e.target.value)}
            rows={2}
            placeholder="Anteckningar för personalen…"
            className="w-full px-3 py-2 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
          />
        </div>
      </div>

      {/* SMS-status */}
      <div className="rounded border border-border bg-card px-4 py-3 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ background: booking?.sms_confirmation_sent ? '#3DAB6A' : '#6B6870' }}
        />
        <span className="text-sm text-muted-foreground">
          SMS-bekräftelse: {booking?.sms_confirmation_sent ? 'skickad' : 'ej skickad'}
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded">{error}</p>
      )}

      {/* Spara + ta bort */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Ta bort
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : saved
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <Save className="h-3.5 w-3.5" />
          }
          {saved ? 'Sparat!' : 'Spara ändringar'}
        </button>
      </div>
    </div>
  )
}
