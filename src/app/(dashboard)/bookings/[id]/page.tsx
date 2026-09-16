'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Car, User, Phone, Mail, Clock, Wrench, Banknote,
  MessageSquare, Loader2, Trash2, CheckCircle2, Save, History, ThumbsUp, ThumbsDown, MessageCircle, UserRound,
} from 'lucide-react'
import type { Booking, BookingStatus, UserRole } from '@/types'
import { cn } from '@/lib/utils/cn'
import { BOOKING_STATUS, BOOKING_STATUSES } from '@/lib/status'
import { BUSINESS_TZ } from '@/lib/time'
import { JobPhotos } from '@/components/jobs/job-photos'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'

const SERVICES = [
  'Invändig städning', 'Utvändig tvätt', 'Hel rekond',
  'Polering', 'Lackskydd', 'Motortvättning', 'Övrigt',
]
const DURATIONS = [30, 60, 90, 120, 180, 240]

interface AssignableEmployee {
  id: string
  full_name: string
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ,
  })
}

function durationLabel(d: number): string {
  if (d < 60) return `${d} min`
  const h = d / 60
  return Number.isInteger(h) ? `${h} tim` : `${Math.floor(h)} tim ${d % 60} min`
}

function Card({ title, children, action, className }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn('card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <p className="label-caps">{title}</p>
        {action}
      </div>
      {children}
    </section>
  )
}

function ReadRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-[3px]" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [booking, setBooking]     = useState<Booking | null>(null)
  const [workers, setWorkers]     = useState<AssignableEmployee[]>([])
  const [myRole, setMyRole]       = useState<UserRole | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [approving, setApproving] = useState(false)
  const [saved, setSaved]         = useState(false)

  // Only admin edits/deletes; admin + manager approve. Unknown role = read-only.
  const canEdit = myRole === 'admin'
  const canApprove = (myRole === 'admin' || myRole === 'manager') && booking?.status === 'pending'

  // Editable fields
  const [status, setStatus]               = useState<BookingStatus>('confirmed')
  const [scheduledAt, setScheduledAt]     = useState('')
  const [duration, setDuration]           = useState(60)
  const [service, setService]             = useState('')
  const [workerId, setWorkerId]           = useState('')
  const [price, setPrice]                 = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [serviceNotes, setServiceNotes]   = useState('')

  const applyBooking = useCallback((data: Booking) => {
    setBooking(data)
    setStatus(data.status)
    setScheduledAt(toLocalInputValue(data.scheduled_at))
    setDuration(data.estimated_duration_minutes)
    setService(data.service_type)
    setWorkerId(data.assigned_worker_id ?? '')
    setPrice(data.total_price != null ? String(data.total_price) : '')
    setCustomerNotes(data.customer_notes ?? '')
    setServiceNotes(data.service_notes ?? '')
  }, [])

  const fetchBooking = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`/api/bookings/${id}`)
    if (!res.ok) return false
    applyBooking(await res.json())
    return true
  }, [id, applyBooking])

  useEffect(() => {
    (async () => {
      const [bookingOk, meRes, workersRes] = await Promise.all([
        fetchBooking(),
        fetch('/api/me'),
        fetch('/api/workers'),
      ])
      if (meRes.ok) {
        const me = await meRes.json() as { role: UserRole }
        setMyRole(me.role)
      }
      if (workersRes.ok) {
        setWorkers(await workersRes.json())
      } else {
        toast.error('Kunde inte hämta anställda', { description: `${workersRes.status} ${workersRes.statusText}` })
      }
      setLoadState(bookingOk ? 'ready' : 'error')
    })()
  }, [fetchBooking])

  const isDirty = booking !== null && (
    status !== booking.status ||
    new Date(scheduledAt).toISOString() !== new Date(booking.scheduled_at).toISOString() ||
    duration !== booking.estimated_duration_minutes ||
    service !== booking.service_type ||
    (workerId || null) !== (booking.assigned_worker_id ?? null) ||
    (price ? parseFloat(price) : null) !== (booking.total_price ?? null) ||
    (customerNotes.trim() || null) !== (booking.customer_notes ?? null) ||
    (serviceNotes.trim() || null) !== (booking.service_notes ?? null)
  )

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        scheduled_at:               new Date(scheduledAt).toISOString(),
        estimated_duration_minutes: duration,
        service_type:               service,
        assigned_worker_id:         workerId || null,
        total_price:                price ? parseFloat(price) : null,
        customer_notes:             customerNotes.trim() || null,
        service_notes:              serviceNotes.trim() || null,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error('Kunde inte spara bokningen', { description: d.error ?? `${res.status} ${res.statusText}` })
    } else {
      setSaved(true)
      toast.success('Bokningen sparades')
      setTimeout(() => setSaved(false), 2000)
      await fetchBooking()
    }
    setSaving(false)
  }

  async function handleApprove(action: 'approved' | 'rejected') {
    if (!confirm(action === 'approved' ? 'Godkänn bokningen? Kunden får ett SMS.' : 'Avvisa bokningen?')) return
    setApproving(true)
    const res = await fetch('/api/bookings/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id, action }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error('Kunde inte uppdatera bokningen', { description: d.error ?? `${res.status} ${res.statusText}` })
    } else {
      const revertedToPending = action === 'approved' && d.status === 'pending'
      if (action === 'rejected') {
        toast.success('Bokningen avvisades')
      } else if (d.smsSent) {
        toast.success('Bokningen godkändes', { description: 'SMS-bekräftelse skickad till kunden' })
      } else if (d.smsError) {
        toast.error(
          revertedToPending
            ? 'SMS kunde inte skickas — bokningen väntar fortfarande på godkännande'
            : 'SMS-bekräftelse kunde inte skickas',
          { description: d.smsError },
        )
      } else {
        toast.success('Bokningen godkändes')
      }
      await fetchBooking()
    }
    setApproving(false)
  }

  async function handleDelete() {
    if (!confirm('Ta bort bokningen? Det går inte att ångra.')) return
    setDeleting(true)
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error('Kunde inte ta bort bokningen', { description: d.error ?? `${res.status} ${res.statusText}` })
      setDeleting(false)
      return
    }
    toast.success('Bokningen togs bort')
    router.push('/calendar')
    router.refresh()
  }

  if (loadState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadState === 'error' || !booking) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted-foreground">Bokningen hittades inte</p>
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm">
          <ArrowLeft />
          Tillbaka
        </button>
      </div>
    )
  }

  const plate = booking.car?.license_plate

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4 pb-10">
      <PageHeader
        leading={
          <button onClick={() => router.back()} aria-label="Tillbaka" className="btn btn-ghost btn-icon btn-sm mt-0.5">
            <ArrowLeft />
          </button>
        }
        title={booking.customer?.full_name ?? 'Bokning'}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span>{booking.car ? `${booking.car.make} ${booking.car.model}` : '—'}</span>
            {plate && <span className="plate text-primary">{plate}</span>}
            <span className="opacity-40">·</span>
            <span>{booking.service_type}</span>
          </span>
        }
        actions={<StatusBadge status={booking.status} />}
      />

      {/* Approve / reject — admin/manager, pending bookings only */}
      {canApprove && (
        <div className="card card-tinted p-4 flex items-center justify-between gap-3 flex-wrap" style={{ '--tint': 'var(--status-pending)' } as CSSProperties}>
          <div>
            <p className="text-sm font-semibold text-status-pending">Bokningen väntar på godkännande</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Godkänn för att bekräfta — kunden får SMS{booking.creator ? ` och ${booking.creator.full_name} får e-post` : ''}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => void handleApprove('rejected')} disabled={approving} className="btn btn-danger btn-sm">
              {approving ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
              Avvisa
            </button>
            <button onClick={() => void handleApprove('approved')} disabled={approving} className="btn btn-success btn-sm">
              {approving ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
              Godkänn
            </button>
          </div>
        </div>
      )}

      {/* Customer + car */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card
          title="Kund"
          action={booking.customer_id && (
            <Link href={`/customers/${booking.customer_id}`} className="btn btn-ghost btn-xs -mr-2">
              <History />
              Historik
            </Link>
          )}
        >
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{booking.customer?.full_name ?? '—'}</span>
          </div>
          {booking.customer?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a href={`tel:${booking.customer.phone}`} className="text-sm tabular text-primary hover:underline">
                {booking.customer.phone}
              </a>
            </div>
          )}
          {booking.customer?.email && (
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">{booking.customer.email}</span>
            </div>
          )}
        </Card>

        <Card title="Bil">
          <div className="flex items-center gap-2">
            <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{booking.car ? `${booking.car.make} ${booking.car.model}` : '—'}</span>
          </div>
          {plate && <p className="plate text-base text-primary pl-[1.4rem]">{plate}</p>}
          {booking.car?.color && <p className="text-xs text-muted-foreground pl-[1.4rem]">{booking.car.color}</p>}
        </Card>
      </div>

      {/* Booking fields */}
      <Card title="Bokning">
        {canEdit ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="label-caps block">Status</label>
              <div className="flex gap-1.5 flex-wrap">
                {BOOKING_STATUSES.map(s => {
                  const meta = BOOKING_STATUS[s]
                  const active = status === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn('badge transition-all', active ? 'badge-status' : 'badge-outline hover:text-foreground hover:border-border-strong')}
                      style={active ? ({ '--badge-color': meta.color } as CSSProperties) : undefined}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="label-caps block" htmlFor="bk-when">Tid</label>
                <div className="field-icon">
                  <Clock />
                  <input id="bk-when" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="field" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="label-caps block" htmlFor="bk-duration">Längd</label>
                <select id="bk-duration" value={duration} onChange={e => setDuration(Number(e.target.value))} className="field">
                  {DURATIONS.map(d => <option key={d} value={d}>{durationLabel(d)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label-caps block" htmlFor="bk-service">Tjänst</label>
                <select id="bk-service" value={service} onChange={e => setService(e.target.value)} className="field">
                  {!SERVICES.includes(service) && <option value={service}>{service}</option>}
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label-caps block" htmlFor="bk-worker">Ansvarig</label>
                <select id="bk-worker" value={workerId} onChange={e => setWorkerId(e.target.value)} className="field">
                  <option value="">Ingen tilldelad</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label-caps block" htmlFor="bk-price">Pris (kr)</label>
                <div className="field-icon">
                  <Banknote />
                  <input id="bk-price" type="number" min={0} inputMode="numeric" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} className="field" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <ReadRow icon={Clock} label="Tid" value={<span className="capitalize">{formatWhen(booking.scheduled_at)}</span>} />
            <ReadRow icon={Wrench} label="Tjänst" value={`${booking.service_type} · ${durationLabel(booking.estimated_duration_minutes)}`} />
            <ReadRow icon={UserRound} label="Ansvarig" value={booking.assigned_worker?.full_name ?? <span className="text-muted-foreground italic">Ej tilldelad</span>} />
            <ReadRow icon={Banknote} label="Pris" value={booking.total_price != null ? `${booking.total_price.toLocaleString('sv-SE')} kr` : '—'} />
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card title="Anteckningar">
        {canEdit ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="label-caps flex items-center gap-1.5" htmlFor="bk-cnotes">
                <MessageSquare className="h-3 w-3" />
                Kundönskemål
              </label>
              <textarea id="bk-cnotes" value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} rows={3} placeholder="Inga önskemål angivna…" className="field" />
            </div>
            <div className="space-y-1.5">
              <label className="label-caps flex items-center gap-1.5" htmlFor="bk-snotes">
                <Wrench className="h-3 w-3" />
                Interna anteckningar
              </label>
              <textarea id="bk-snotes" value={serviceNotes} onChange={e => setServiceNotes(e.target.value)} rows={3} placeholder="Anteckningar för personalen…" className="field" />
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <ReadRow icon={MessageSquare} label="Kundönskemål" value={booking.customer_notes || <span className="text-muted-foreground italic">Inga</span>} />
            <ReadRow icon={Wrench} label="Interna anteckningar" value={booking.service_notes || <span className="text-muted-foreground italic">Inga</span>} />
          </div>
        )}
      </Card>

      {/* Job documentation */}
      {booking.status !== 'cancelled' && (
        <Card title="Jobbdokumentation">
          <JobPhotos bookingId={id} workerId={booking.assigned_worker_id ?? null} />
        </Card>
      )}

      {/* Meta */}
      <div className="card px-4 py-3 grid sm:grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <MessageCircle
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: booking.sms_confirmation_sent ? 'var(--status-completed)' : 'var(--status-not-started)' }}
          />
          <span className="text-muted-foreground">
            SMS-bekräftelse <span className="text-foreground font-medium">{booking.sms_confirmation_sent ? 'skickad' : 'ej skickad'}</span>
          </span>
        </div>
        {booking.creator && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="avatar avatar-sm">{booking.creator.full_name.charAt(0)}</div>
            <span className="text-muted-foreground truncate">
              Inlagd av <span className="text-foreground font-medium">{booking.creator.full_name}</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Skapad {new Date(booking.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: BUSINESS_TZ })}</span>
        </div>
      </div>

      {/* Save + delete — admin only, floats above the content while scrolling */}
      {canEdit && (
        <div className="sticky bottom-2 z-10 card px-4 py-3 flex items-center justify-between gap-3" style={{ boxShadow: 'var(--shadow-pop)' }}>
          <button onClick={handleDelete} disabled={deleting || saving} className="btn btn-danger btn-sm">
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Ta bort
          </button>
          <div className="flex items-center gap-3">
            {isDirty && !saved && <span className="text-xs text-muted-foreground hidden sm:inline">Osparade ändringar</span>}
            <button onClick={handleSave} disabled={saving || (!isDirty && !saved)} className="btn btn-primary">
              {saving ? <Loader2 className="animate-spin" /> : saved ? <CheckCircle2 /> : <Save />}
              {saved ? 'Sparat' : 'Spara ändringar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
