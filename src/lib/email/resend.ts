import 'server-only'

// Email notifications via Resend.
// To activate: set RESEND_API_KEY in .env.local (and optionally EMAIL_FROM / ADMIN_EMAIL).
// All send functions resolve to { sent: boolean } and never throw — callers
// fire-and-forget them, so a network failure must not become an unhandled rejection.

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS   = process.env.EMAIL_FROM ?? 'noreply@komfort.se'
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL ?? 'goran@komfort.se'

interface BookingEmailData {
  bookingId:   string
  customerName: string
  carMake:     string
  carModel:    string
  licensePlate?: string
  serviceType: string
  scheduledAt: string
  workerName:  string
  workerEmail: string
}

// Customer names, plates and reasons are user input — escape before interpolating into HTML.
function esc(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  })
}

function carLine(data: BookingEmailData): string {
  return `${esc(data.carMake)} ${esc(data.carModel)}${data.licensePlate ? ` (${esc(data.licensePlate)})` : ''}`
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[email:placeholder] to=${to} subject="${subject}"`)
    return false
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[email] Resend ${res.status} for "${subject}": ${text}`)
      return false
    }
    return true
  } catch (err) {
    console.error('[email] send failed:', err instanceof Error ? err.message : err)
    return false
  } finally {
    clearTimeout(timeout)
  }
}

// Sent to the admin when a worker submits a booking for approval.
export async function sendBookingSubmitted(data: BookingEmailData): Promise<{ sent: boolean }> {
  const html = `
    <h2>Ny bokning väntar på godkännande</h2>
    <p><strong>${esc(data.workerName)}</strong> har lagt in en ny bokning:</p>
    <ul>
      <li><strong>Kund:</strong> ${esc(data.customerName)}</li>
      <li><strong>Bil:</strong> ${carLine(data)}</li>
      <li><strong>Tjänst:</strong> ${esc(data.serviceType)}</li>
      <li><strong>Tid:</strong> ${esc(formatWhen(data.scheduledAt))}</li>
    </ul>
    <p>Logga in på portalen för att godkänna eller avvisa bokningen.</p>
  `

  const sent = await sendEmail(ADMIN_EMAIL, `Ny bokning väntar — ${data.customerName}`, html)
  return { sent }
}

// Sent to the worker when their submitted booking is approved.
export async function sendBookingApproved(data: BookingEmailData): Promise<{ sent: boolean }> {
  const html = `
    <h2>Din bokning har godkänts</h2>
    <p>Bokningen nedan är nu bekräftad:</p>
    <ul>
      <li><strong>Kund:</strong> ${esc(data.customerName)}</li>
      <li><strong>Bil:</strong> ${carLine(data)}</li>
      <li><strong>Tjänst:</strong> ${esc(data.serviceType)}</li>
      <li><strong>Tid:</strong> ${esc(formatWhen(data.scheduledAt))}</li>
    </ul>
  `

  const sent = await sendEmail(data.workerEmail, `Bokning godkänd — ${data.customerName}`, html)
  return { sent }
}

// Sent to the worker when their submitted booking is rejected.
export async function sendBookingRejected(data: BookingEmailData & { reason?: string }): Promise<{ sent: boolean }> {
  const html = `
    <h2>Din bokning avvisades</h2>
    <p>Bokningen för <strong>${esc(data.customerName)}</strong> (${esc(data.carMake)} ${esc(data.carModel)}) godkändes inte.</p>
    ${data.reason ? `<p><strong>Anledning:</strong> ${esc(data.reason)}</p>` : ''}
    <p>Kontakta din chef om du har frågor.</p>
  `

  const sent = await sendEmail(data.workerEmail, `Bokning avvisad — ${data.customerName}`, html)
  return { sent }
}
