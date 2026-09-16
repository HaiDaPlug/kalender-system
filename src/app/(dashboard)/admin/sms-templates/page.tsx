'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Loader2, Save, CheckCircle2, MessageSquare, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { calcSmsParts } from '@/lib/sms/sms-parts'
import { formatSmsDate, formatSmsTime, interpolateTemplate } from '@/lib/sms/format'
import { useLiveMinute } from '@/lib/hooks/use-live-minute'
import { PageHeader } from '@/components/ui/page-header'
import { SmsPhonePreview } from '@/components/sms/sms-phone-preview'

const VARIABLE_HINTS = [
  { label: '{name}',    desc: 'Kundens namn' },
  { label: '{service}', desc: 'Tjänst' },
  { label: '{date}',    desc: 'Datum (måndag 9 juni)' },
  { label: '{time}',    desc: 'Klockslag (10:00)' },
]

// The preview booking: tomorrow at 10:00, formatted by the same functions the
// real send uses, so the phone shows exactly what a customer would receive.
const SAMPLE_NAME = 'Anna Svensson'
const SAMPLE_SERVICE = 'Hel rekond'

function sampleBookingDate(now: Date): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

interface SmsTemplate {
  id: string
  name: string
  body: string
  updated_at: string
  sender?: string
}

export default function SmsTemplatesPage() {
  const [template, setTemplate] = useState<SmsTemplate | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/sms-templates')
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return }
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          toast.error('Kunde inte ladda mall', { description: d.error ?? `${r.status} ${r.statusText}` })
          return
        }
        const data: SmsTemplate = await r.json()
        setTemplate(data)
        setBody(data.body)
      })
      .catch(err => toast.error('Kunde inte ladda mall', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      }))
      .finally(() => setLoading(false))
  }, [])

  function insertVariable(variable: string) {
    const el = textareaRef.current
    if (!el) { setBody(prev => prev + variable); return }

    const start = el.selectionStart
    const end   = el.selectionEnd
    const next  = body.slice(0, start) + variable + body.slice(end)
    setBody(next)

    requestAnimationFrame(() => {
      el.selectionStart = start + variable.length
      el.selectionEnd   = start + variable.length
      el.focus()
    })
  }

  async function handleSave() {
    if (!template) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/sms-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: template.id, body }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error('Kunde inte spara mall', { description: (d as { error?: string }).error ?? `${res.status} ${res.statusText}` })
        return
      }
      const updated: SmsTemplate = await res.json()
      setTemplate(prev => ({ ...updated, sender: prev?.sender }))
      setBody(updated.body)
      setSaved(true)
      toast.success('Mallen sparades')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast.error('Kunde inte spara mall', {
        description: err instanceof Error ? err.message : 'Nätverksfel — kontrollera anslutningen',
      })
    } finally {
      setSaving(false)
    }
  }

  const smsInfo = calcSmsParts(body)
  const dirty = template !== null && body !== template.body
  const missingVars = VARIABLE_HINTS.filter(v => !body.includes(v.label)).map(v => v.label)

  // Real clock for the phone (0 until hydrated → blank instead of a mismatch).
  const minute = useLiveMinute()
  const now = useMemo(() => (minute ? new Date(minute * 60_000) : null), [minute])
  const clock = now ? formatSmsTime(now) : ''
  const sample = useMemo(() => {
    const when = sampleBookingDate(now ?? new Date())
    return { name: SAMPLE_NAME, service: SAMPLE_SERVICE, date: formatSmsDate(when), time: formatSmsTime(when) }
  }, [now])
  const preview = interpolateTemplate(body, sample)

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="SMS-mall"
        subtitle="Meddelandet som skickas till kunden när en bokning bekräftas"
      />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar mall…</span>
        </div>
      ) : notFound ? (
        <div className="card empty">
          <MessageSquare />
          <p className="empty-title">Ingen aktiv mall konfigurerad</p>
          <p className="empty-text">Kontakta en systemadministratör.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          {/* Editor */}
          <div className="lg:col-span-3 card p-4 space-y-4">
            <div className="space-y-2">
              <p className="label-caps">Infoga variabel</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_HINTS.map(v => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => insertVariable(v.label)}
                    title={v.desc}
                    className="btn btn-secondary btn-xs font-mono text-primary"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label-caps block" htmlFor="sms-body">Meddelandetext</label>
              <textarea
                id="sms-body"
                ref={textareaRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                className="field font-mono text-[0.85rem] leading-relaxed"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground tabular">
                  {smsInfo.chars} tecken · {smsInfo.encoding === 'gsm7' ? 'GSM-7' : 'Unicode'} · {smsInfo.parts === 1 ? '1 SMS' : `${smsInfo.parts} SMS-delar`}
                  {smsInfo.parts > 1 && <span className="text-status-pending ml-1">— debiteras per del</span>}
                </p>
                {missingVars.length > 0 && (
                  <p className="text-xs text-muted-foreground">Används inte: <span className="font-mono">{missingVars.join(' ')}</span></p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {template?.updated_at ? (
                <p className="text-xs text-muted-foreground/70">
                  Senast ändrad {new Date(template.updated_at).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : <span />}
              <div className="flex gap-2">
                {dirty && (
                  <button type="button" onClick={() => template && setBody(template.body)} className="btn btn-ghost btn-sm">
                    <RotateCcw />
                    Ångra
                  </button>
                )}
                <button onClick={handleSave} disabled={saving || !dirty} className="btn btn-primary btn-sm">
                  {saving ? <Loader2 className="animate-spin" /> : saved ? <CheckCircle2 /> : <Save />}
                  {saved ? 'Sparat' : 'Spara mall'}
                </button>
              </div>
            </div>
          </div>

          {/* Live preview — the message on a real phone */}
          <div className="lg:col-span-2 card overflow-hidden lg:sticky lg:top-0">
            {/* Phone rises from the top of the card; the lower part fades out so
                the message sits just above the fade instead of an empty screen. */}
            <div
              className="relative h-[380px] overflow-hidden"
              style={{ background: 'radial-gradient(360px 240px at 50% 30%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 70%)' }}
            >
              <div className="absolute left-1/2 top-6 -translate-x-1/2 w-[300px] max-w-[88%] drop-shadow-[0_28px_40px_rgba(0,0,0,0.55)]">
                <SmsPhonePreview
                  message={preview}
                  sender={template?.sender ?? 'KOMFORT'}
                  time={clock}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: 'linear-gradient(to bottom, transparent, var(--card))' }} />
            </div>

            <p className="px-4 py-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
              Exempelbokning: {sample.name}, {sample.service}, {sample.date} kl {sample.time}. Avsändare <span className="font-mono text-foreground">{template?.sender ?? 'KOMFORT'}</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
