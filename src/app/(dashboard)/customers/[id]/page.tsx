'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Car, CalendarDays,
  MessageSquare, Loader2, Save, CheckCircle2,
  Clock, TrendingUp, Hash
} from 'lucide-react'
import Link from 'next/link'
import type { Booking, SmsLog, Customer } from '@/types'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Väntar',    color: '#C4962A' },
  confirmed:   { label: 'Bekräftad', color: '#4A90D9' },
  in_progress: { label: 'Pågår',     color: '#8B5CF6' },
  completed:   { label: 'Klar',      color: '#3DAB6A' },
  cancelled:   { label: 'Avbokad',   color: '#E05252' },
}

const SMS_TYPE_LABEL: Record<string, string> = {
  confirmation:    'Orderbekräftelse',
  ready_for_pickup: 'Redo för upphämtning',
  manual:          'Manuellt',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CustomerHistoryPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [customer, setCustomer]   = useState<Customer | null>(null)
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [smsLogs, setSmsLogs]     = useState<SmsLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [notes, setNotes]         = useState('')
  const [activeTab, setActiveTab] = useState<'historik' | 'sms'>('historik')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/customers/${id}`)
    const data = await res.json()
    if (!res.ok) { setLoading(false); return }
    setCustomer(data.customer)
    setBookings(data.bookings)
    setSmsLogs(data.smsLogs)
    setNotes(data.customer.notes ?? '')
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveNotes() {
    setSaving(true)
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  // Statistik
  const completedBookings = bookings.filter(b => b.status === 'completed')
  const totalSpent        = completedBookings.reduce((s, b) => s + (b.total_price ?? 0), 0)
  const uniqueCars        = [...new Map(bookings.map(b => [b.car_id, b.car])).values()].filter(Boolean)
  const lastVisit         = completedBookings[0]?.scheduled_at

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
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">Tillbaka</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">{customer.full_name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Kundprofil</p>
        </div>
      </div>

      {/* Kontaktinfo */}
      <div className="rounded border border-border bg-card p-4 space-y-2">
        <p className="label-caps">Kontakt</p>
        <div className="flex flex-wrap gap-4">
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Phone className="h-3.5 w-3.5" />
              {customer.phone}
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Mail className="h-3.5 w-3.5" />
              {customer.email}
            </a>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Kund sedan {formatDate(customer.created_at)}</p>
      </div>

      {/* Statistik — 4 kort */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded border border-border bg-card p-3 text-center">
          <p className="text-2xl font-semibold tabular">{bookings.length}</p>
          <p className="label-caps mt-1">Besök</p>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <p className="text-2xl font-semibold tabular">{completedBookings.length}</p>
          <p className="label-caps mt-1">Klara</p>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <p className="text-2xl font-semibold tabular">{uniqueCars.length}</p>
          <p className="label-caps mt-1">Bilar</p>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <p className="text-lg font-semibold tabular">
            {totalSpent > 0 ? `${totalSpent.toLocaleString('sv-SE')} kr` : '—'}
          </p>
          <p className="label-caps mt-1">Totalt</p>
        </div>
      </div>

      {/* Bilar */}
      {uniqueCars.length > 0 && (
        <div className="rounded border border-border bg-card p-4 space-y-2">
          <p className="label-caps">Bilar</p>
          <div className="space-y-1.5">
            {uniqueCars.map((car, i) => car && (
              <div key={i} className="flex items-center gap-3">
                <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm">{car.make} {car.model}</span>
                {car.license_plate && (
                  <span className="text-sm font-mono tracking-widest text-primary font-semibold ml-auto">
                    {car.license_plate}
                  </span>
                )}
                {car.color && (
                  <span className="text-xs text-muted-foreground">{car.color}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Senaste besök */}
      {lastVisit && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded border border-border bg-card">
          <TrendingUp className="h-3.5 w-3.5 text-green-400 shrink-0" />
          <span className="text-sm text-muted-foreground">Senaste besök:</span>
          <span className="text-sm font-medium">{formatDate(lastVisit)}</span>
        </div>
      )}

      {/* Anteckningar om kunden */}
      <div className="rounded border border-border bg-card p-4 space-y-3">
        <p className="label-caps flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" />
          Anteckningar om kunden
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="T.ex. föredrar SMS-kontakt, allergisk mot vissa produkter, VIP-kund…"
          className="w-full px-3 py-2 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
        />
        <button
          onClick={handleSaveNotes}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? 'Sparat!' : 'Spara'}
        </button>
      </div>

      {/* Flikar: Historik / SMS */}
      <div className="flex border-b border-border">
        {(['historik', 'sms'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'historik' ? `Bokningshistorik (${bookings.length})` : `SMS (${smsLogs.length})`}
          </button>
        ))}
      </div>

      {/* Bokningshistorik */}
      {activeTab === 'historik' && (
        <div className="space-y-2">
          {bookings.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Inga bokningar ännu.</p>
          )}
          {bookings.map(b => {
            const st = STATUS_LABEL[b.status]
            return (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-start gap-3 rounded border border-border bg-card px-4 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{b.service_type}</p>
                    {b.total_price && (
                      <span className="text-xs text-muted-foreground ml-auto">{b.total_price.toLocaleString('sv-SE')} kr</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(b.scheduled_at)}
                    </span>
                    {b.car && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        {b.car.license_plate ?? `${b.car.make} ${b.car.model}`}
                      </span>
                    )}
                  </div>
                  {b.customer_notes && (
                    <p className="text-xs mt-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 truncate">
                      {b.customer_notes}
                    </p>
                  )}
                </div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5"
                  style={{ color: st?.color, background: `${st?.color}18` }}
                >
                  {st?.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* SMS-historik */}
      {activeTab === 'sms' && (
        <div className="space-y-2">
          {smsLogs.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Inga SMS skickade ännu.</p>
          )}
          {smsLogs.map(sms => (
            <div key={sms.id} className="rounded border border-border bg-card px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {SMS_TYPE_LABEL[sms.sms_type] ?? sms.sms_type}
                </span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: sms.status === 'sent' || sms.status === 'delivered' ? '#3DAB6A' : '#E05252' }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {sms.sent_at ? formatDateTime(sms.sent_at) : formatDateTime(sms.created_at)}
                  </span>
                </div>
              </div>
              <p className="text-sm leading-relaxed">{sms.message_body}</p>
              <p className="text-xs text-muted-foreground tabular">{sms.phone_number}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
