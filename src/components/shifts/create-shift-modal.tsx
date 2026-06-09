'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Profile } from '@/types'
import { Modal } from '@/components/ui/modal'

interface Props {
  open: boolean
  initialDate: Date
  currentUser: Profile
  onClose: () => void
  onCreated: () => void
}

function toLocalInputValue(date: Date, offsetHours = 0): string {
  const d = new Date(date)
  d.setHours(d.getHours() + offsetHours, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateShiftModal({ open, initialDate, currentUser, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultDate = new Date(initialDate)
  defaultDate.setHours(8, 0, 0, 0)
  const endDate = new Date(initialDate)
  endDate.setHours(17, 0, 0, 0)

  const [startsAt, setStartsAt] = useState(toLocalInputValue(defaultDate))
  const [endsAt, setEndsAt]     = useState(toLocalInputValue(endDate))
  const [notes, setNotes]       = useState('')

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
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: currentUser.id,
          startsAt: new Date(startsAt).toISOString(),
          endsAt:   new Date(endsAt).toISOString(),
          notes:    notes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Något gick fel')

      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">Lägg in pass</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Skickas för godkännande</p>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Formulär */}
      <form id="nytt-pass-form" onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-secondary">
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            {currentUser.full_name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium">{currentUser.full_name}</span>
        </div>

        <div className="space-y-1">
          <label className="label-caps text-muted-foreground">Starttid</label>
          <input
            required
            type="datetime-local"
            value={startsAt}
            onChange={e => setStartsAt(e.target.value)}
            className="w-full h-10 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:scale-150 [&::-webkit-calendar-picker-indicator]:[filter:brightness(0)_invert(1)]"
          />
        </div>

        <div className="space-y-1">
          <label className="label-caps text-muted-foreground">Sluttid</label>
          <input
            required
            type="datetime-local"
            value={endsAt}
            onChange={e => setEndsAt(e.target.value)}
            className="w-full h-10 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:scale-150 [&::-webkit-calendar-picker-indicator]:[filter:brightness(0)_invert(1)]"
          />
        </div>

        <div className="space-y-1">
          <label className="label-caps text-muted-foreground">Kommentar (valfritt)</label>
          <textarea
            placeholder="T.ex. kan börja lite senare, byter pass med Kalle…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded">{error}</p>
        )}
      </form>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-border gap-3">
        <p className="text-xs text-muted-foreground">Passet aktiveras efter godkännande</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit"
            form="nytt-pass-form"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Skicka in pass
          </button>
        </div>
      </div>
    </Modal>
  )
}
