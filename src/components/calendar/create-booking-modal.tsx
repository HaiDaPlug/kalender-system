'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Profile } from '@/types'
import { Modal } from '@/components/ui/modal'

interface Props {
  open: boolean
  initialDate: Date
  workers: Profile[]
  onClose: () => void
  onCreated: () => void
}

const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240]

const SERVICES = [
  'Invändig städning',
  'Utvändig tvätt',
  'Hel rekond',
  'Polering',
  'Lackskydd',
  'Motortvättning',
  'Övrigt',
]

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CreateBookingModal({ open, initialDate, workers, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

  const [carMake, setCarMake] = useState('')
  const [carModel, setCarModel] = useState('')
  const [carPlate, setCarPlate] = useState('')
  const [carColor, setCarColor] = useState('')

  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(initialDate))
  const [duration, setDuration] = useState(60)
  const [service, setService] = useState(SERVICES[0])
  const [workerId, setWorkerId] = useState('')
  const [workerName, setWorkerName] = useState('')
  const [status, setStatus] = useState<'pending' | 'confirmed'>('confirmed')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail: customerEmail || undefined,
          carMake,
          carModel,
          carPlate: carPlate || undefined,
          carColor: carColor || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          estimatedDurationMinutes: duration,
          serviceType: service,
          assignedWorkerId: workerId || undefined,
          workerName: !workerId ? (workerName || undefined) : undefined,
          status,
          totalPrice: price ? parseFloat(price) : undefined,
          customerNotes: notes || undefined,
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
    <Modal open={open} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold">Ny bokning</h2>
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Formulär */}
      <form id="ny-bokning-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Kund */}
        <section>
          <p className="label-caps mb-2 text-muted-foreground">Kund</p>
          <div className="space-y-2">
            <input
              required
              placeholder="Namn *"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <input
              required
              type="tel"
              placeholder="Telefon * (SMS-bekräftelse skickas hit)"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <input
              type="email"
              placeholder="E-post (valfritt)"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        </section>

        {/* Bil */}
        <section>
          <p className="label-caps mb-2 text-muted-foreground">Bil</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Märke * (t.ex. Volvo)"
              value={carMake}
              onChange={e => setCarMake(e.target.value)}
              className="h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <input
              required
              placeholder="Modell * (t.ex. V70)"
              value={carModel}
              onChange={e => setCarModel(e.target.value)}
              className="h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <input
              placeholder="Registreringsnummer"
              value={carPlate}
              onChange={e => setCarPlate(e.target.value.toUpperCase())}
              className="h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground uppercase tracking-widest"
            />
            <input
              placeholder="Färg"
              value={carColor}
              onChange={e => setCarColor(e.target.value)}
              className="h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        </section>

        {/* Bokning */}
        <section>
          <p className="label-caps mb-2 text-muted-foreground">Bokning</p>
          <div className="space-y-2">
            <input
              required
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={service}
                onChange={e => setService(e.target.value)}
                className="h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : `${d / 60} tim${d > 60 ? ` ${d % 60 > 0 ? d % 60 + ' min' : ''}` : ''}`}
                  </option>
                ))}
              </select>
            </div>

            {workers.length > 0 ? (
              <select
                value={workerId}
                onChange={e => setWorkerId(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Välj anställd / pass</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.full_name}</option>
                ))}
              </select>
            ) : (
              <input
                placeholder="Anställd / pass (t.ex. Kalle, Förmiddag)"
                value={workerName}
                onChange={e => setWorkerName(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            )}

            <select
              value={status}
              onChange={e => setStatus(e.target.value as 'pending' | 'confirmed')}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="confirmed">Bekräftad</option>
              <option value="pending">Väntar på bekräftelse</option>
            </select>

            <input
              type="number"
              placeholder="Pris (kr)"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />

            <textarea
              placeholder="Anteckningar / önskemål (valfritt)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
            />
          </div>
        </section>

        {error && (
          <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded">{error}</p>
        )}
      </form>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0 gap-3">
        <p className="text-xs text-muted-foreground">SMS-bekräftelse skickas automatiskt</p>
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
            form="ny-bokning-form"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Skapa bokning
          </button>
        </div>
      </div>
    </Modal>
  )
}
