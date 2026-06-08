'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Clock } from 'lucide-react'
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
  return `${date}  ${s}–${e}`
}

export function PendingShiftsBanner({ reviewerId }: Props) {
  const [shifts, setShifts]   = useState<Shift[]>([])
  const [acting, setActing]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts?status=pending')
      if (!res.ok) {
        setError(await readErrorMessage(res, 'Kunde inte hämta väntande pass'))
        return
      }

      const data = await res.json()
      setShifts(Array.isArray(data) ? data : [])
    } catch {
      setError('Nätverksfel — kunde inte hämta väntande pass')
    }
  }, [])

  useEffect(() => { (async () => { await fetchPending() })() }, [fetchPending])

  async function handleAction(shiftId: string, action: 'approved' | 'rejected') {
    if (!reviewerId) return
    setError(null)
    setActing(shiftId)
    try {
      const res = await fetch('/api/shifts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, action, reviewerId }),
      })
      if (!res.ok) {
        setError(await readErrorMessage(res, 'Något gick fel, försök igen'))
      } else {
        await fetchPending()
      }
    } catch {
      setError('Nätverksfel — kontrollera anslutningen')
    } finally {
      setActing(null)
    }
  }

  if (shifts.length === 0 && !error) return null

  return (
    <div className="rounded border border-amber-400/30 bg-amber-400/5 overflow-hidden animate-fade-up">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-400/20">
        <Clock className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-400">
          {shifts.length} pass väntar på godkännande
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
      <div className="divide-y divide-amber-400/10">
        {shifts.map(shift => (
          <div key={shift.id} className="px-4 py-3 flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
              {shift.worker?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{shift.worker?.full_name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{formatShiftTime(shift)}</p>
              {shift.notes && (
                <p className="text-xs mt-1 px-2 py-1 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
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
                  className="h-7 w-7 flex items-center justify-center rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleAction(shift.id, 'rejected')}
                  disabled={acting === shift.id}
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
