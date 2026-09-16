import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, REVIEWER_ROLES } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRawSms } from '@/lib/sms/46elks'
import { jsonError, readJsonObject, isNonEmptyString } from '@/lib/api'

const MAX_MESSAGE_CHARS = 600

// POST /api/sms/send { bookingId, message } — manual SMS to the booking's customer (admin/manager).
// A manual message is logged as sms_type 'manual' and does NOT count as the
// booking confirmation, so bookings.sms_confirmation_sent is left untouched.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(REVIEWER_ROLES)
  if (!auth.ok) return auth.response

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const { bookingId, message } = body
  if (!isNonEmptyString(bookingId) || !isNonEmptyString(message)) return jsonError('bookingId och message krävs', 400)
  if (message.trim().length > MAX_MESSAGE_CHARS) return jsonError(`Meddelandet får vara högst ${MAX_MESSAGE_CHARS} tecken`, 400)

  const service = createServiceClient()

  const { data: booking, error: bookingErr } = await service
    .from('bookings')
    .select('id, customer_id, customer:customers(phone)')
    .eq('id', bookingId)
    .maybeSingle()

  if (bookingErr) return jsonError(bookingErr.message, 500)
  if (!booking)   return jsonError('Bokningen hittades inte', 404)

  const customer = booking.customer as { phone?: string | null } | null
  if (!customer?.phone) return jsonError('Kunden saknar telefonnummer', 400)

  const result = await sendRawSms(customer.phone, message.trim())

  const { error: logErr } = await service.from('sms_logs').insert({
    booking_id:          booking.id,
    customer_id:         booking.customer_id,
    phone_number:        result.normalisedTo ?? customer.phone,
    message_body:        message.trim(),
    sms_type:            'manual',
    provider:            '46elks',
    status:              result.sent ? 'sent' : 'failed',
    provider_message_id: result.messageId ?? null,
    sent_at:             result.sent ? new Date().toISOString() : null,
    error_message:       result.error ?? null,
  })

  if (logErr) {
    console.error('[sms:send] failed to insert sms_log:', logErr.message)
  }

  if (!result.sent) {
    return jsonError(result.error ?? 'SMS kunde inte skickas', 502)
  }

  return NextResponse.json({ sent: true, messageId: result.messageId })
}
