'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { Shift, Profile } from '@/types'

interface Props {
  currentUser: Profile
}

function formatShiftTime(shift: Shift): string {
  const start = new Date(shift.starts_at)
  const end   = new Date(shift.ends_at)
  const date  = start.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  const s     = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const e     = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return `${date}  ${s}–${e}`
}

export function PendingShiftsPanel({ currentUser }: Props) {
  const [shifts, setShifts]     = useState<Shift[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [acting, setActing]     = useState<string | null>(null)

  const isAdmin = ['admin', 'manager'].includes(currentUser.role)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/shifts?status=pending')
    const data = await res.json()
    setShifts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  async function handleAction(shiftId: string, action: 'approved' | 'rejected') {
    setActing(shiftId)
    await fetch('/api/shifts/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId, action, reviewerId: currentUser.id }),
    })
    await fetchPending()
    setActing(null)
  }

  // Anställda ser bara sina egna väntande pass
  const visible = isAdmin
    ? shifts
    : shifts.filter(s => s.worker_id === currentUser.id)

  if (visible.length === 0 && !loading) return null

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold">
            {isAdmin ? 'Pass som väntar på godkännande' : 'Mina väntande pass'}
          </span>
          {visible.length > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-amber-400/20 text-amber-400 text-xs font-semibold flex items-center justify-center">
              {visible.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Laddar…</div>
          )}
          {!loading && visible.map(shift => (
            <div key={shift.id} className="px-4 py-3 flex items-start gap-3">
              {/* Avatar */}
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
                {shift.worker?.full_name?.charAt(0).toUpperCase() ?? '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{shift.worker?.full_name ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{formatShiftTime(shift)}</p>
                {shift.notes && (
                  <p className="text-xs mt-1 px-2 py-1 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                    {shift.notes}
                  </p>
                )}
              </div>

              {/* Knappar — bara admin ser godkänn/avvisa */}
              {isAdmin && (
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
      )}
    </div>
  )
}
