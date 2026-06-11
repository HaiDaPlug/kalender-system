// Email notifications via Resend.
// To activate: set RESEND_API_KEY in .env.local and replace the placeholder bodies below.
// All send functions return { sent: boolean } — callers never need to know the provider.

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

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    // Placeholder — log to console until Resend is configured
    console.log(`[email:placeholder] to=${to} subject="${subject}"`)
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  })

  return res.ok
}

// Sent to admin (Goran) when a worker submits a booking for approval.
export async function sendBookingSubmitted(data: BookingEmailData): Promise<{ sent: boolean }> {
  const date = new Date(data.scheduledAt).toLocaleString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  const html = `
    <h2>Ny bokning väntar på godkännande</h2>
    <p><strong>${data.workerName}</strong> har lagt in en ny bokning:</p>
    <ul>
      <li><strong>Kund:</strong> ${data.customerName}</li>
      <li><strong>Bil:</strong> ${data.carMake} ${data.carModel}${data.licensePlate ? ` (${data.licensePlate})` : ''}</li>
      <li><strong>Tjänst:</strong> ${data.serviceType}</li>
      <li><strong>Tid:</strong> ${date}</li>
    </ul>
    <p>Logga in på portalen för att godkänna eller avvisa bokningen.</p>
  `

  const sent = await sendEmail(ADMIN_EMAIL, `Ny bokning väntar — ${data.customerName}`, html)
  return { sent }
}

// Sent to the worker when Goran approves their submitted booking.
export async function sendBookingApproved(data: BookingEmailData): Promise<{ sent: boolean }> {
  const date = new Date(data.scheduledAt).toLocaleString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  const html = `
    <h2>Din bokning har godkänts</h2>
    <p>Bokningen nedan är nu bekräftad:</p>
    <ul>
      <li><strong>Kund:</strong> ${data.customerName}</li>
      <li><strong>Bil:</strong> ${data.carMake} ${data.carModel}${data.licensePlate ? ` (${data.licensePlate})` : ''}</li>
      <li><strong>Tjänst:</strong> ${data.serviceType}</li>
      <li><strong>Tid:</strong> ${date}</li>
    </ul>
  `

  const sent = await sendEmail(data.workerEmail, `Bokning godkänd — ${data.customerName}`, html)
  return { sent }
}

// Sent to the worker when Goran rejects their submitted booking.
export async function sendBookingRejected(data: BookingEmailData & { reason?: string }): Promise<{ sent: boolean }> {
  const html = `
    <h2>Din bokning avvisades</h2>
    <p>Bokningen för <strong>${data.customerName}</strong> (${data.carMake} ${data.carModel}) godkändes inte.</p>
    ${data.reason ? `<p><strong>Anledning:</strong> ${data.reason}</p>` : ''}
    <p>Kontakta din chef om du har frågor.</p>
  `

  const sent = await sendEmail(data.workerEmail, `Bokning avvisad — ${data.customerName}`, html)
  return { sent }
}
