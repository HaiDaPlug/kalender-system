'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Save, MessageSquare } from 'lucide-react'
import { calcSmsParts } from '@/lib/sms/sms-parts'

const VARIABLE_HINTS = [
  { label: '{name}',    desc: 'Kundens namn' },
  { label: '{service}', desc: 'Tjänsttyp' },
  { label: '{date}',    desc: 'Datum (måndag 9 juni)' },
  { label: '{time}',    desc: 'Klockslag (10:00)' },
]

interface SmsTemplate {
  id: string
  name: string
  body: string
  updated_at: string
}

export default function SmsTemplatesPage() {
  const [template, setTemplate] = useState<SmsTemplate | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/sms-templates')
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return }
        if (!r.ok) { setError('Kunde inte ladda mall'); return }
        const data: SmsTemplate = await r.json()
        setTemplate(data)
        setBody(data.body)
      })
      .catch(() => setError('Nätverksfel — kontrollera anslutningen'))
      .finally(() => setLoading(false))
  }, [])

  function insertVariable(variable: string) {
    const el = textareaRef.current
    if (!el) { setBody(prev => prev + variable); return }

    const start = el.selectionStart
    const end   = el.selectionEnd
    const next  = body.slice(0, start) + variable + body.slice(end)
    setBody(next)

    // Restore cursor after the inserted variable
    requestAnimationFrame(() => {
      el.selectionStart = start + variable.length
      el.selectionEnd   = start + variable.length
      el.focus()
    })
  }

  async function handleSave() {
    if (!template) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/sms-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: template.id, body }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Kunde inte spara')
        return
      }
      const updated: SmsTemplate = await res.json()
      setTemplate(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Nätverksfel — kontrollera anslutningen')
    } finally {
      setSaving(false)
    }
  }

  const smsInfo = calcSmsParts(body)

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          SMS-mallar
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Redigera meddelandet som skickas till kunden när en bokning bekräftas.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Laddar mall…</span>
        </div>
      ) : notFound ? (
        <div className="rounded border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Ingen aktiv mall konfigurerad. Kontakta en systemadministratör.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Variable hint chips */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Klicka för att infoga variabel:
            </p>
            <div className="flex flex-wrap gap-2">
              {VARIABLE_HINTS.map(v => (
                <button
                  key={v.label}
                  onClick={() => insertVariable(v.label)}
                  title={v.desc}
                  className="px-2.5 py-1 text-xs rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-mono"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Meddelandetext
            </label>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm rounded border border-border bg-secondary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 resize-none font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {smsInfo.chars} tecken ({smsInfo.encoding === 'gsm7' ? 'GSM-7' : 'Unicode'})
              {' · '}
              {smsInfo.parts === 1 ? '1 SMS' : `${smsInfo.parts} SMS-delar`}
              {smsInfo.parts > 1 && (
                <span className="text-yellow-400 ml-1">— debiteras per del</span>
              )}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || body === template?.body}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
          >
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" />
            }
            {saved ? 'Sparat!' : 'Spara mall'}
          </button>

          {template?.updated_at && (
            <p className="text-xs text-muted-foreground/60">
              Senast ändrad: {new Date(template.updated_at).toLocaleString('sv-SE')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
