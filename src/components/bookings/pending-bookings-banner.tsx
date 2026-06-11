'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Clock, Car } from 'lucide-react'
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
  const [error, setError]       = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings?status=pending')
      if (!res.ok) { setError('Kunde inte hämta väntande bokningar'); return }
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch {
      setError('Nätverksfel — kunde inte hämta väntande bokningar')
    }
  }, [])

  useEffect(() => { void fetchPending() }, [fetchPending])

  async function handleAction(bookingId: string, action: 'approved' | 'rejected') {
    if (!reviewerId) return
    setError(null)
    setActing(bookingId)
    try {
      const res = await fetch('/api/bookings/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Något gick fel, försök igen')
      } else {
        await fetchPending()
      }
    } catch {
      setError('Nätverksfel — kontrollera anslutningen')
    } finally {
      setActing(null)
    }
  }

  if (bookings.length === 0 && !error) return null

  return (
    <div className="rounded border border-blue-400/30 bg-blue-400/5 overflow-hidden animate-fade-up">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-400/20">
        <Clock className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-blue-400">
          {bookings.length} {bookings.length === 1 ? 'bokning väntar' : 'bokningar väntar'} på godkännande
        </span>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:text-red-300">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="divide-y divide-blue-400/10">
        {bookings.map(booking => (
          <div key={booking.id} className="px-4 py-3 flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-blue-400/10 border border-blue-400/20 flex items-center justify-center shrink-0 mt-0.5">
              <Car className="h-3.5 w-3.5 text-blue-400" />
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
                  className="h-7 w-7 flex items-center justify-center rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void handleAction(booking.id, 'rejected')}
                  disabled={acting === booking.id}
                  title="Avvisa"
                  className="h-7 w-7 flex items-center justify-center rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
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
