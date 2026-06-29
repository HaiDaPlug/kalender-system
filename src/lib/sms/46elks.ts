import 'server-only'

const API_USERNAME = process.env.FORTYSIX_ELKS_API_USERNAME
const API_PASSWORD = process.env.FORTYSIX_ELKS_API_PASSWORD
const FROM         = process.env.FORTYSIX_ELKS_FROM ?? 'RenGor'

export interface SmsSendResult {
  sent: boolean
  messageId?: string
  error?: string
  message: string
}

export interface BookingSmsData {
  phone:        string
  customerName: string
  serviceType:  string
  scheduledAt:  string
}

function normalisePhone(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, '')
  let normalised: string
  if (s.startsWith('+'))      normalised = s
  else if (s.startsWith('00')) normalised = `+${s.slice(2)}`
  else if (s.startsWith('0'))  normalised = `+46${s.slice(1)}`
  else                         normalised = s

  return /^\+[1-9]\d{7,14}$/.test(normalised) ? normalised : null
}

function interpolateTemplate(
  template: string,
  vars: { name: string; date: string; time: string; service: string },
): string {
  return template
    .replace(/{name}/g,    vars.name)
    .replace(/{date}/g,    vars.date)
    .replace(/{time}/g,    vars.time)
    .replace(/{service}/g, vars.service)
}

export async function sendRawSms(to: string, message: string): Promise<Omit<SmsSendResult, 'message'> & { normalisedTo: string | null }> {
  const normalisedTo = normalisePhone(to)
  if (!normalisedTo) return { sent: false, error: 'Invalid phone number', normalisedTo: null }
  const result = await sendSms(normalisedTo, message)
  return { ...result, normalisedTo }
}

async function sendSms(to: string, message: string): Promise<Omit<SmsSendResult, 'message'>> {
  if (!API_USERNAME || !API_PASSWORD) {
    console.log(`[sms:placeholder] to=${to} message="${message}"`)
    return { sent: false, error: 'No API credentials configured' }
  }

  const credentials = Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString('base64')
  const body = new URLSearchParams({ from: FROM, to, message })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch('https://api.46elks.com/a1/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { sent: false, error: `46elks ${res.status}: ${text}` }
    }

    const data = await res.json() as { id?: string }
    return { sent: true, messageId: data.id }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return { sent: false, error }
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendBookingConfirmedSms(
  data: BookingSmsData,
  templateBody: string,
): Promise<SmsSendResult> {
  const to = normalisePhone(data.phone)
  if (!to) {
    return { sent: false, error: 'Invalid phone number', message: '' }
  }

  const dt = new Date(data.scheduledAt)
  const date = dt.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' })
  const time = dt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })

  const message = interpolateTemplate(templateBody, {
    name:    data.customerName,
    service: data.serviceType,
    date,
    time,
  })

  const result = await sendSms(to, message)
  return { ...result, message }
}
