'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import Link from 'next/link'
import { Check, X, Clock, Car, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Booking } from '@/types'
import { BUSINESS_TZ } from '@/lib/time'

interface Props {
  reviewerId?: string
}

function formatBookingTime(booking: Booking): string {
  return new Date(booking.scheduled_at).toLocaleString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ,
  })
}

export function PendingBookingsBanner({ reviewerId }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [acting, setActing]     = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings?status=pending')
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error('Kunde inte hämta väntande bokningar', { description: d.error ?? `${res.status} ${res.statusText}` })
        return
      }
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error('Kunde inte hämta väntande bokningar', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    }
  }, [])

  useEffect(() => { (async () => { await fetchPending() })() }, [fetchPending])

  async function handleAction(bookingId: string, action: 'approved' | 'rejected') {
    if (!reviewerId) return
    if (action === 'rejected' && !confirm('Avvisa bokningen?')) return
    setActing(bookingId)
    try {
      const res = await fetch('/api/bookings/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
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
        await fetchPending()
      }
    } catch (err) {
      toast.error('Kunde inte uppdatera bokningen', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    } finally {
      setActing(null)
    }
  }

  if (bookings.length === 0) return null

  return (
    <div className="card card-tinted overflow-hidden animate-fade-up" style={{ '--tint': 'var(--status-pending)' } as CSSProperties}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-status-pending/25">
        <Clock className="h-4 w-4 text-status-pending" />
        <span className="text-sm font-semibold text-status-pending">
          {bookings.length} {bookings.length === 1 ? 'bokning väntar' : 'bokningar väntar'} på godkännande
        </span>
      </div>

      <ul className="divide-y divide-status-pending/15">
        {bookings.map(booking => (
          <li key={booking.id} className="px-4 py-3 flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-status-pending/12 border border-status-pending/30 flex items-center justify-center shrink-0">
              <Car className="h-3.5 w-3.5 text-status-pending" />
            </div>
            <Link href={`/bookings/${booking.id}`} className="flex-1 min-w-0 group">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                {booking.customer?.full_name ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {booking.car ? `${booking.car.make} ${booking.car.model}` : '—'}
                {booking.car?.license_plate && <span className="plate ml-1.5 text-primary/90">{booking.car.license_plate}</span>}
                <span className="mx-1.5 opacity-50">·</span>
                {booking.service_type}
              </p>
              <p className="text-xs text-muted-foreground tabular mt-0.5">
                {formatBookingTime(booking)}
                {booking.creator && <span> · inlagd av {booking.creator.full_name}</span>}
              </p>
            </Link>

            {reviewerId && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => void handleAction(booking.id, 'approved')}
                  disabled={acting === booking.id}
                  title="Godkänn — kunden får SMS"
                  aria-label="Godkänn"
                  className="btn btn-success btn-icon btn-sm"
                >
                  {acting === booking.id ? <Loader2 className="animate-spin" /> : <Check />}
                </button>
                <button
                  onClick={() => void handleAction(booking.id, 'rejected')}
                  disabled={acting === booking.id}
                  title="Avvisa"
                  aria-label="Avvisa"
                  className="btn btn-danger btn-icon btn-sm"
                >
                  <X />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
