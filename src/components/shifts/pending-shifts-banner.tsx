'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { Check, X, CalendarClock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Shift } from '@/types'

interface Props {
  reviewerId?: string
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text()
  if (!text) return fallback
  try {
    const data = JSON.parse(text) as { error?: string }
    return data.error ?? fallback
  } catch {
    return text
  }
}

function formatShiftTime(shift: Shift): string {
  const start = new Date(shift.starts_at)
  const end   = new Date(shift.ends_at)
  const date  = start.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  const s     = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const e     = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const hours = Math.round((end.getTime() - start.getTime()) / 36e5 * 10) / 10
  return `${date} · ${s}–${e} · ${hours} tim`
}

export function PendingShiftsBanner({ reviewerId }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [acting, setActing] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts?status=pending')
      if (!res.ok) {
        toast.error('Kunde inte hämta väntande pass', {
          description: await readErrorMessage(res, `${res.status} ${res.statusText}`),
        })
        return
      }
      const data = await res.json()
      setShifts(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error('Kunde inte hämta väntande pass', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    }
  }, [])

  useEffect(() => { (async () => { await fetchPending() })() }, [fetchPending])

  async function handleAction(shiftId: string, action: 'approved' | 'rejected') {
    if (!reviewerId) return
    setActing(shiftId)
    try {
      // The server uses the signed-in user as reviewer.
      const res = await fetch('/api/shifts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, action }),
      })
      if (!res.ok) {
        toast.error('Kunde inte uppdatera passet', {
          description: await readErrorMessage(res, `${res.status} ${res.statusText}`),
        })
      } else {
        toast.success(action === 'approved' ? 'Passet godkändes' : 'Passet avvisades')
        await fetchPending()
      }
    } catch (err) {
      toast.error('Kunde inte uppdatera passet', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    } finally {
      setActing(null)
    }
  }

  if (shifts.length === 0) return null

  return (
    <div className="card card-tinted overflow-hidden animate-fade-up" style={{ '--tint': 'var(--status-pending)' } as CSSProperties}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-status-pending/25">
        <CalendarClock className="h-4 w-4 text-status-pending" />
        <span className="text-sm font-semibold text-status-pending">
          {shifts.length} pass väntar på godkännande
        </span>
      </div>
      <ul className="divide-y divide-status-pending/15">
        {shifts.map(shift => (
          <li key={shift.id} className="px-4 py-3 flex items-start gap-3">
            <div className="avatar">{shift.worker?.full_name?.charAt(0) ?? '?'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{shift.worker?.full_name ?? '—'}</p>
              <p className="text-xs text-muted-foreground tabular">{formatShiftTime(shift)}</p>
              {shift.notes && (
                <p className="text-xs mt-1.5 px-2.5 py-1.5 rounded-md bg-status-pending/10 text-status-pending border border-status-pending/25">
                  {shift.notes}
                </p>
              )}
            </div>
            {reviewerId && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleAction(shift.id, 'approved')}
                  disabled={acting === shift.id}
                  title="Godkänn"
                  aria-label="Godkänn"
                  className="btn btn-success btn-icon btn-sm"
                >
                  {acting === shift.id ? <Loader2 className="animate-spin" /> : <Check />}
                </button>
                <button
                  onClick={() => handleAction(shift.id, 'rejected')}
                  disabled={acting === shift.id}
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
