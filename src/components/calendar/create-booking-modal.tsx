'use client'

import { useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
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

function durationLabel(d: number): string {
  if (d < 60) return `${d} min`
  const h = d / 60
  return Number.isInteger(h) ? `${h} tim` : `${Math.floor(h)} tim ${d % 60} min`
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <label className="label-caps block" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  )
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
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          carMake: carMake.trim(),
          carModel: carModel.trim(),
          carPlate: carPlate.trim() || undefined,
          carColor: carColor.trim() || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          estimatedDurationMinutes: duration,
          serviceType: service,
          assignedWorkerId: workerId || undefined,
          status,
          totalPrice: price ? parseFloat(price) : undefined,
          customerNotes: notes.trim() || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? `Bokningen kunde inte skapas (${res.status} ${res.statusText})`)
      }

      if (data.status === 'pending' && status === 'pending') {
        toast.success('Bokningen är inlagd', { description: 'Väntar på godkännande' })
      } else if (data.smsSent) {
        toast.success('Bokningen är bekräftad', { description: 'SMS-bekräftelse skickad till kunden' })
      } else if (data.smsError) {
        const wasReverted = status === 'confirmed' && data.status === 'pending'
        toast.error(
          wasReverted
            ? 'SMS kunde inte skickas — bokningen sattes till "Väntar" istället för bekräftad'
            : 'SMS-bekräftelse kunde inte skickas',
          { description: data.smsError },
        )
      } else {
        toast.success('Bokningen är inlagd')
      }

      onCreated()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Något gick fel'
      setError(message)
      toast.error('Bokningen kunde inte skapas', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-[0.95rem] font-semibold">Ny bokning</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Kund, bil och tid — SMS skickas när bokningen bekräftas</p>
        </div>
        <button onClick={onClose} aria-label="Stäng" className="btn btn-ghost btn-icon btn-sm">
          <X />
        </button>
      </div>

      {/* Form */}
      <form id="ny-bokning-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Kund */}
        <section className="space-y-3">
          <p className="text-sm font-semibold">Kund</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Namn *" htmlFor="nb-name">
              <input id="nb-name" required autoFocus placeholder="För- och efternamn" value={customerName} onChange={e => setCustomerName(e.target.value)} className="field" />
            </Field>
            <Field label="Telefon *" htmlFor="nb-phone" hint="SMS-bekräftelsen skickas hit">
              <input id="nb-phone" required type="tel" placeholder="07X-XXX XX XX" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="field" />
            </Field>
          </div>
          <Field label="E-post (valfritt)" htmlFor="nb-email">
            <input id="nb-email" type="email" placeholder="kund@epost.se" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="field" />
          </Field>
        </section>

        {/* Bil */}
        <section className="space-y-3">
          <p className="text-sm font-semibold">Bil</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Märke *" htmlFor="nb-make">
              <input id="nb-make" required placeholder="t.ex. Volvo" value={carMake} onChange={e => setCarMake(e.target.value)} className="field" />
            </Field>
            <Field label="Modell *" htmlFor="nb-model">
              <input id="nb-model" required placeholder="t.ex. V70" value={carModel} onChange={e => setCarModel(e.target.value)} className="field" />
            </Field>
            <Field label="Registreringsnummer" htmlFor="nb-plate">
              <input id="nb-plate" placeholder="ABC 123" value={carPlate} onChange={e => setCarPlate(e.target.value.toUpperCase())} className="field plate" />
            </Field>
            <Field label="Färg" htmlFor="nb-color">
              <input id="nb-color" placeholder="t.ex. Svart" value={carColor} onChange={e => setCarColor(e.target.value)} className="field" />
            </Field>
          </div>
        </section>

        {/* Bokning */}
        <section className="space-y-3">
          <p className="text-sm font-semibold">Bokning</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tidpunkt *" htmlFor="nb-when">
              <input id="nb-when" required type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="field" />
            </Field>
            <Field label="Längd" htmlFor="nb-duration">
              <select id="nb-duration" value={duration} onChange={e => setDuration(Number(e.target.value))} className="field">
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{durationLabel(d)}</option>)}
              </select>
            </Field>
            <Field label="Tjänst" htmlFor="nb-service">
              <select id="nb-service" value={service} onChange={e => setService(e.target.value)} className="field">
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Ansvarig" htmlFor="nb-worker">
              <select id="nb-worker" value={workerId} onChange={e => setWorkerId(e.target.value)} className="field">
                <option value="">Ej tilldelad</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
              </select>
            </Field>
            <Field label="Status" htmlFor="nb-status">
              <select id="nb-status" value={status} onChange={e => setStatus(e.target.value as 'pending' | 'confirmed')} className="field">
                <option value="confirmed">Bekräftad</option>
                <option value="pending">Väntar på bekräftelse</option>
              </select>
            </Field>
            <Field label="Pris (kr)" htmlFor="nb-price">
              <input id="nb-price" type="number" min={0} step={1} inputMode="numeric" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} className="field" />
            </Field>
          </div>
          <Field label="Anteckningar / önskemål" htmlFor="nb-notes">
            <textarea id="nb-notes" placeholder="T.ex. extra noga med barnstolen…" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="field" />
          </Field>
        </section>

        {error && (
          <p className="text-xs text-destructive bg-destructive/12 border border-destructive/30 px-3 py-2 rounded-md">{error}</p>
        )}
      </form>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0 gap-3">
        <p className="text-xs text-muted-foreground">
          {status === 'confirmed'
            ? 'SMS-bekräftelse skickas till kunden direkt'
            : 'Inget SMS skickas förrän bokningen godkänns'}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Avbryt
          </button>
          <button type="submit" form="ny-bokning-form" disabled={loading} className="btn btn-primary btn-sheen">
            {loading ? <Loader2 className="animate-spin" /> : <Check />}
            <span>Skapa bokning</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
