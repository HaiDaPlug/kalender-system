'use client'

import { useState } from 'react'
import { X, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'

export interface ShiftUser {
  id: string
  full_name: string
}

interface Props {
  open: boolean
  initialDate: Date
  currentUser: ShiftUser
  onClose: () => void
  onCreated: () => void
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CreateShiftModal({ open, initialDate, currentUser, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultStart = new Date(initialDate)
  defaultStart.setHours(8, 0, 0, 0)
  const defaultEnd = new Date(initialDate)
  defaultEnd.setHours(17, 0, 0, 0)

  const [startsAt, setStartsAt] = useState(toLocalInputValue(defaultStart))
  const [endsAt, setEndsAt]     = useState(toLocalInputValue(defaultEnd))
  const [notes, setNotes]       = useState('')

  const hours = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 36e5 * 10) / 10)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('Sluttid måste vara efter starttid')
      setLoading(false)
      return
    }

    try {
      // The server derives the worker from the session; no id is sent.
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startsAt: new Date(startsAt).toISOString(),
          endsAt:   new Date(endsAt).toISOString(),
          notes:    notes.trim() || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? `Passet kunde inte skapas (${res.status} ${res.statusText})`)
      }

      onCreated()
      onClose()
      toast.success('Passet skickades in', { description: 'Väntar på godkännande' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Något gick fel'
      setError(message)
      toast.error('Passet kunde inte skapas', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-[0.95rem] font-semibold">Lägg in pass</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Skickas för godkännande</p>
        </div>
        <button onClick={onClose} aria-label="Stäng" className="btn btn-ghost btn-icon btn-sm">
          <X />
        </button>
      </div>

      {/* Form */}
      <form id="nytt-pass-form" onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-secondary border border-border">
          <div className="avatar avatar-sm">{currentUser.full_name.charAt(0)}</div>
          <span className="text-sm font-medium">{currentUser.full_name}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="label-caps" htmlFor="shift-start">Starttid</label>
            <input
              id="shift-start"
              required
              type="datetime-local"
              value={startsAt}
              onChange={e => setStartsAt(e.target.value)}
              className="field"
            />
          </div>
          <div className="space-y-1.5">
            <label className="label-caps" htmlFor="shift-end">Sluttid</label>
            <input
              id="shift-end"
              required
              type="datetime-local"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
              className="field"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="label-caps" htmlFor="shift-notes">Kommentar (valfritt)</label>
          <textarea
            id="shift-notes"
            placeholder="T.ex. kan börja lite senare, byter pass med Kalle…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="field"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/12 border border-destructive/30 px-3 py-2 rounded-md">{error}</p>
        )}
      </form>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-border gap-3">
        <p className="text-xs text-muted-foreground tabular">{hours > 0 ? `${hours} timmar` : 'Passet aktiveras efter godkännande'}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Avbryt
          </button>
          <button type="submit" form="nytt-pass-form" disabled={loading} className="btn btn-primary">
            {loading ? <Loader2 className="animate-spin" /> : <Send />}
            Skicka in pass
          </button>
        </div>
      </div>
    </Modal>
  )
}
