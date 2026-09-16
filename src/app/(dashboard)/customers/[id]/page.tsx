'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Car,
  MessageSquare, Loader2, Save, CheckCircle2,
  Clock, TrendingUp, Inbox, MessageCircle,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Booking, SmsLog, Customer, UserRole } from '@/types'
import { BUSINESS_TZ } from '@/lib/time'
import { cn } from '@/lib/utils/cn'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'

const SMS_TYPE_LABEL: Record<string, string> = {
  confirmation:     'Bokningsbekräftelse',
  ready_for_pickup: 'Redo för upphämtning',
  manual:           'Manuellt',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: BUSINESS_TZ })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ,
  })
}

export default function CustomerHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [customer, setCustomer]   = useState<Customer | null>(null)
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [smsLogs, setSmsLogs]     = useState<SmsLog[]>([])
  const [myRole, setMyRole]       = useState<UserRole | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [notes, setNotes]         = useState('')
  const [activeTab, setActiveTab] = useState<'historik' | 'sms'>('historik')

  const canEditNotes = myRole === 'admin' || myRole === 'manager'

  const fetchData = useCallback(async () => {
    const [res, meRes] = await Promise.all([fetch(`/api/customers/${id}`), fetch('/api/me')])
    if (meRes.ok) setMyRole(((await meRes.json()) as { role: UserRole }).role)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error('Kunde inte hämta kund', { description: data.error ?? `${res.status} ${res.statusText}` })
      setLoading(false)
      return
    }
    setCustomer(data.customer)
    setBookings(data.bookings)
    setSmsLogs(data.smsLogs)
    setNotes(data.customer.notes ?? '')
    setLoading(false)
  }, [id])

  useEffect(() => { (async () => { await fetchData() })() }, [fetchData])

  async function handleSaveNotes() {
    setSaving(true)
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notes.trim() || null }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error('Kunde inte spara anteckningar', { description: d.error ?? `${res.status} ${res.statusText}` })
    } else {
      setSaved(true)
      setCustomer(prev => prev ? { ...prev, notes: notes.trim() || undefined } : prev)
      toast.success('Anteckningar sparade')
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  // Stats
  const completedBookings = bookings.filter(b => b.status === 'completed')
  const totalSpent        = completedBookings.reduce((s, b) => s + (b.total_price ?? 0), 0)
  const uniqueCars        = [...new Map(bookings.map(b => [b.car_id, b.car])).values()].filter(Boolean)
  const lastVisit         = completedBookings[0]?.scheduled_at
  const notesDirty        = (notes.trim() || '') !== (customer?.notes ?? '')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted-foreground">Kund hittades inte</p>
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm">
          <ArrowLeft />
          Tillbaka
        </button>
      </div>
    )
  }

  const stats = [
    { label: 'Besök', value: String(bookings.length) },
    { label: 'Klara', value: String(completedBookings.length) },
    { label: 'Bilar', value: String(uniqueCars.length) },
    { label: 'Totalt', value: totalSpent > 0 ? `${totalSpent.toLocaleString('sv-SE')} kr` : '—' },
  ]

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4 pb-10">
      <PageHeader
        leading={
          <button onClick={() => router.back()} aria-label="Tillbaka" className="btn btn-ghost btn-icon btn-sm mt-0.5">
            <ArrowLeft />
          </button>
        }
        title={customer.full_name}
        subtitle={`Kund sedan ${formatDate(customer.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="btn btn-secondary btn-sm">
                <Phone />
                <span className="tabular">{customer.phone}</span>
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="btn btn-ghost btn-sm hidden sm:inline-flex">
                <Mail />
                {customer.email}
              </a>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card p-4">
            <p className="label-caps">{s.label}</p>
            <p className="text-2xl font-light tabular mt-1.5 tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Cars */}
        <div className="card p-4 space-y-3">
          <p className="label-caps">Bilar</p>
          {uniqueCars.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Inga bilar registrerade</p>
          ) : (
            <div className="space-y-2">
              {uniqueCars.map((car, i) => car && (
                <div key={i} className="flex items-center gap-3">
                  <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 min-w-0 truncate">{car.make} {car.model}{car.color ? <span className="text-muted-foreground"> · {car.color}</span> : null}</span>
                  {car.license_plate && <span className="plate text-sm text-primary shrink-0">{car.license_plate}</span>}
                </div>
              ))}
            </div>
          )}
          {lastVisit && (
            <div className="flex items-center gap-2 pt-2 border-t border-border text-sm">
              <TrendingUp className="h-3.5 w-3.5 text-status-completed shrink-0" />
              <span className="text-muted-foreground">Senaste besök</span>
              <span className="font-medium ml-auto">{formatDate(lastVisit)}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card p-4 space-y-3">
          <p className="label-caps flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" />
            Anteckningar om kunden
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            disabled={!canEditNotes}
            placeholder={canEditNotes ? 'T.ex. föredrar SMS-kontakt, VIP-kund…' : 'Inga anteckningar'}
            className="field"
          />
          {canEditNotes && (
            <div className="flex justify-end">
              <button onClick={handleSaveNotes} disabled={saving || (!notesDirty && !saved)} className="btn btn-primary btn-sm">
                {saving ? <Loader2 className="animate-spin" /> : saved ? <CheckCircle2 /> : <Save />}
                {saved ? 'Sparat' : 'Spara'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="segmented">
        <button data-active={activeTab === 'historik'} onClick={() => setActiveTab('historik')}>
          Bokningar <span className="tabular opacity-70">({bookings.length})</span>
        </button>
        <button data-active={activeTab === 'sms'} onClick={() => setActiveTab('sms')}>
          SMS <span className="tabular opacity-70">({smsLogs.length})</span>
        </button>
      </div>

      {activeTab === 'historik' && (
        <div className="space-y-2">
          {bookings.length === 0 && (
            <div className="card empty">
              <Inbox />
              <p className="empty-title">Inga bokningar ännu</p>
            </div>
          )}
          {bookings.map(b => (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="card flex items-start gap-3 px-4 py-3 hover:border-border-strong hover:bg-secondary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{b.service_type}</p>
                  {b.total_price != null && (
                    <span className="text-xs text-muted-foreground ml-auto tabular">{b.total_price.toLocaleString('sv-SE')} kr</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(b.scheduled_at)}
                  </span>
                  {b.car && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Car className="h-3 w-3" />
                      {b.car.license_plate ? <span className="plate">{b.car.license_plate}</span> : `${b.car.make} ${b.car.model}`}
                    </span>
                  )}
                </div>
                {b.customer_notes && (
                  <p className="text-xs mt-2 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/25 truncate">
                    {b.customer_notes}
                  </p>
                )}
              </div>
              <StatusBadge status={b.status} size="sm" className="shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
      )}

      {activeTab === 'sms' && (
        <div className="space-y-2">
          {smsLogs.length === 0 && (
            <div className="card empty">
              <MessageCircle />
              <p className="empty-title">Inga SMS skickade ännu</p>
              {!canEditNotes && <p className="empty-text">SMS-historik visas endast för administratörer.</p>}
            </div>
          )}
          {smsLogs.map(sms => {
            const ok = sms.status === 'sent' || sms.status === 'delivered'
            return (
              <div key={sms.id} className="card px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {SMS_TYPE_LABEL[sms.sms_type] ?? sms.sms_type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={cn('badge badge-sm badge-status')} style={{ '--badge-color': ok ? 'var(--status-completed)' : sms.status === 'pending' ? 'var(--status-pending)' : 'var(--status-cancelled)' } as React.CSSProperties}>
                      {ok ? 'Skickat' : sms.status === 'pending' ? 'Väntar' : sms.status === 'unknown' ? 'Okänt' : 'Misslyckades'}
                    </span>
                    <span className="text-xs text-muted-foreground tabular">
                      {formatDateTime(sms.sent_at ?? sms.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{sms.message_body}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground tabular">{sms.phone_number}</p>
                  {sms.error_message && <p className="text-xs text-destructive truncate">{sms.error_message}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
