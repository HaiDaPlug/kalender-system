import 'server-only'

import type { ServiceClient } from '@/lib/supabase/service'
import { sendBookingConfirmedSms } from '@/lib/sms/46elks'

/*
  The booking-confirmation SMS flow, shared by POST /api/bookings/create and
  POST /api/bookings/approve. Both routes used to carry their own copy with
  slightly different failure handling; this is the single implementation.

  Steps:
    1. Load the active template (sms_templates.is_active = true)
    2. Insert a `pending` sms_log row. The partial unique index on
       (booking_id, sms_type) rejects a second confirmation while one is
       pending/sent, which is our duplicate-send guard.
    3. Call 46elks
    4. Update the log row to sent/failed, and flip bookings.sms_confirmation_sent

  Returns { sent, error } and never throws — the caller decides what to do
  with the booking status.
*/

export interface ConfirmationSmsInput {
  bookingId: string
  customerId: string
  phone: string | null | undefined
  customerName: string
  serviceType: string
  scheduledAt: string
}

export interface ConfirmationSmsResult {
  sent: boolean
  error: string | null
}

const STALE_PENDING_MS = 5 * 60 * 1000

export async function sendConfirmationSms(
  service: ServiceClient,
  input: ConfirmationSmsInput,
  logPrefix = '[sms]',
): Promise<ConfirmationSmsResult> {
  if (!input.phone) {
    console.warn(`${logPrefix} booking=${input.bookingId} — customer has no phone, skipping SMS`)
    return { sent: false, error: 'Kunden saknar telefonnummer' }
  }

  const { data: template, error: templateErr } = await service
    .from('sms_templates')
    .select('body')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (templateErr) {
    console.error(`${logPrefix} template fetch error:`, templateErr.message)
    return { sent: false, error: templateErr.message }
  }
  if (!template?.body) {
    console.warn(`${logPrefix} no active template configured — skipping SMS`)
    return { sent: false, error: 'Ingen aktiv SMS-mall konfigurerad' }
  }

  // Reserve the send by inserting a pending log row first.
  const { data: logRow, error: logErr } = await service
    .from('sms_logs')
    .insert({
      booking_id:   input.bookingId,
      customer_id:  input.customerId,
      phone_number: input.phone,
      message_body: template.body,
      sms_type:     'confirmation',
      provider:     '46elks',
      status:       'pending',
    })
    .select('id')
    .single()

  if (logErr || !logRow) {
    if (logErr?.code !== '23505') {
      console.error(`${logPrefix} failed to insert sms_log:`, logErr?.code, logErr?.message)
      return { sent: false, error: logErr?.message ?? 'Kunde inte logga SMS' }
    }

    // Unique violation: a confirmation is already pending or sent for this booking.
    // If the blocking row is a stale pending (process died mid-send), mark it
    // unknown so a human reconciles it — never auto-resend.
    const { data: existing } = await service
      .from('sms_logs')
      .select('id, status, created_at')
      .eq('booking_id', input.bookingId)
      .eq('sms_type', 'confirmation')
      .neq('status', 'failed')
      .maybeSingle()

    const isStale = existing?.status === 'pending'
      && existing.created_at
      && Date.now() - new Date(existing.created_at).getTime() > STALE_PENDING_MS

    if (isStale && existing) {
      await service
        .from('sms_logs')
        .update({ status: 'unknown', error_message: 'stale pending — delivery unknown, manual check required' })
        .eq('id', existing.id)
      console.warn(`${logPrefix} stale pending sms_log for booking ${input.bookingId} marked unknown`)
      return { sent: false, error: 'Ett tidigare SMS-försök hänger kvar — kontrollera SMS-loggen manuellt' }
    }

    if (existing?.status === 'sent' || existing?.status === 'delivered') {
      // Already confirmed earlier — treat as success so the booking can be confirmed.
      console.log(`${logPrefix} booking=${input.bookingId} already has a sent confirmation`)
      await service.from('bookings').update({ sms_confirmation_sent: true }).eq('id', input.bookingId)
      return { sent: true, error: null }
    }

    return { sent: false, error: 'Ett SMS för denna bokning är redan på väg' }
  }

  const result = await sendBookingConfirmedSms(
    {
      phone:        input.phone,
      customerName: input.customerName,
      serviceType:  input.serviceType,
      scheduledAt:  input.scheduledAt,
    },
    template.body,
  )
  console.log(`${logPrefix} 46elks result for booking=${input.bookingId}: sent=${result.sent} messageId=${result.messageId ?? '-'} error=${result.error ?? '-'}`)

  const { error: logUpdateError } = await service
    .from('sms_logs')
    .update({
      message_body:        result.message || template.body,
      status:              result.sent ? 'sent' : 'failed',
      provider_message_id: result.messageId ?? null,
      sent_at:             result.sent ? new Date().toISOString() : null,
      error_message:       result.error ?? null,
    })
    .eq('id', logRow.id)

  if (logUpdateError) {
    console.error(`${logPrefix} failed to update sms_log after send:`, logUpdateError.message)
  }

  if (!result.sent) {
    return { sent: false, error: result.error ?? 'SMS kunde inte skickas' }
  }

  const { error: flagError } = await service
    .from('bookings')
    .update({ sms_confirmation_sent: true })
    .eq('id', input.bookingId)

  if (flagError) {
    console.error(`${logPrefix} failed to set sms_confirmation_sent:`, flagError.message)
  }

  return { sent: true, error: null }
}
