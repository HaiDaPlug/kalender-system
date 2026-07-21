'use client'

import { useState, useEffect } from 'react'
import { Check, X, Clock, Car } from 'lucide-react'
import { toast } from 'sonner'
import type { Booking } from '@/types'

interface Props {
  reviewerId?: string
}

function formatBookingTime(booking: Booking): string {
  return new Date(booking.scheduled_at).toLocaleString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function PendingBookingsBanner({ reviewerId }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [acting, setActing]     = useState<string | null>(null)

  async function fetchPending() {
    try {
      const res = await fetch('/api/bookings?status=pending')
      if (!res.ok) {
        toast.error('Kunde inte hämta väntande bokningar', { description: `${res.status} ${res.statusText}` })
        return
      }
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error('Kunde inte hämta väntande bokningar', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/bookings?status=pending')
      .then(async res => {
        if (cancelled) return
        if (!res.ok) {
          toast.error('Kunde inte hämta väntande bokningar', { description: `${res.status} ${res.statusText}` })
          return
        }
        const data = await res.json()
        if (!cancelled) setBookings(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error('Kunde inte hämta väntande bokningar', {
            description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
          })
        }
      })
    return () => { cancelled = true }
  }, [])

  async function handleAction(bookingId: string, action: 'approved' | 'rejected') {
    if (!reviewerId) return
    setActing(bookingId)
    try {
      const res = await fetch('/api/bookings/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error('Kunde inte uppdatera bokningen', {
          description: d.error ?? `${res.status} ${res.statusText}`,
        })
      } else {
        toast.success(action === 'approved' ? 'Bokningen godkändes' : 'Bokningen avvisades')
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
    <div className="rounded border border-status-pending/30 bg-status-pending/5 overflow-hidden animate-fade-up">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-status-pending/20">
        <Clock className="h-4 w-4 text-status-pending" />
        <span className="text-sm font-semibold text-status-pending">
          {bookings.length} {bookings.length === 1 ? 'bokning väntar' : 'bokningar väntar'} på godkännande
        </span>
      </div>

      <div className="divide-y divide-status-pending/10">
        {bookings.map(booking => (
          <div key={booking.id} className="px-4 py-3 flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-status-pending/10 border border-status-pending/20 flex items-center justify-center shrink-0 mt-0.5">
              <Car className="h-3.5 w-3.5 text-status-pending" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {booking.customer?.full_name ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {booking.car?.make} {booking.car?.model}
                {booking.car?.license_plate && ` · ${booking.car.license_plate}`}
                {' · '}{booking.service_type}
              </p>
              <p className="text-xs text-muted-foreground">{formatBookingTime(booking)}</p>
            </div>

            {reviewerId && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => void handleAction(booking.id, 'approved')}
                  disabled={acting === booking.id}
                  title="Godkänn"
                  className="h-7 w-7 flex items-center justify-center rounded bg-status-completed/10 text-status-completed hover:bg-status-completed/20 disabled:opacity-40 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void handleAction(booking.id, 'rejected')}
                  disabled={acting === booking.id}
                  title="Avvisa"
                  className="h-7 w-7 flex items-center justify-center rounded bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-40 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
