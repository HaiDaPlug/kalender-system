import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingApproved, sendBookingRejected } from '@/lib/email/resend'
import { sendBookingConfirmedSms } from '@/lib/sms/46elks'

// POST /api/bookings/approve
// Admin approves or rejects a pending booking.
// On approve: status → 'confirmed', email sent to the worker who submitted it.
// On reject:  status → 'cancelled', email sent with optional reason.
export async function POST(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user) {
    const { data: actor } = await sessionClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!['admin', 'manager'].includes((actor as { role: string } | null)?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await request.json() as {
    bookingId: string
    action: 'approved' | 'rejected'
    reason?: string
  }

  if (!body.bookingId || !['approved', 'rejected'].includes(body.action)) {
    return NextResponse.json({ error: 'bookingId and action required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch the booking + creator profile for the email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error: fetchError } = await (service as any)
    .from('bookings')
    .select('*, customer:customers(*), car:cars(*), creator:profiles!bookings_created_by_fkey(*)')
    .eq('id', body.bookingId)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const newStatus = body.action === 'approved' ? 'confirmed' : 'cancelled'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (service as any)
    .from('bookings')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', body.bookingId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Send email to the worker who submitted the booking (fire-and-forget)
  if (booking.creator?.email) {
    const emailData = {
      bookingId:    booking.id,
      customerName: booking.customer?.full_name ?? '—',
      carMake:      booking.car?.make ?? '—',
      carModel:     booking.car?.model ?? '—',
      licensePlate: booking.car?.license_plate,
      serviceType:  booking.service_type,
      scheduledAt:  booking.scheduled_at,
      workerName:   booking.creator.full_name,
      workerEmail:  booking.creator.email,
    }

    if (body.action === 'approved') {
      void sendBookingApproved(emailData)
    } else {
      void sendBookingRejected({ ...emailData, reason: body.reason })
    }
  }

  // Send confirmation SMS to the customer on approval
  if (body.action === 'approved' && !booking.customer?.phone) {
    console.warn(`[sms:approve] booking=${body.bookingId} — customer has no phone, skipping SMS`)
  }
  if (body.action === 'approved' && booking.customer?.phone) {
    console.log(`[sms:approve] booking=${body.bookingId} — starting SMS flow`)
    await (async () => {
      // Fetch active template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: template, error: templateErr } = await (service as any)
        .from('sms_templates')
        .select('body')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (templateErr) {
        console.error('[sms:approve] Template fetch error:', templateErr.message)
        return
      }
      if (!template?.body) {
        console.warn('[sms:approve] No active template configured — skipping SMS')
        return
      }
      console.log('[sms:approve] Template found, inserting sms_log...')

      // Insert pending log first — unique index prevents duplicate sends.
      // On 23505: if the blocking row is a stale pending (>5 min, crashed send),
      // mark it unknown (delivery uncertain) and skip resend — requires manual reconciliation.
      const logId = await (async (): Promise<string | null> => {
        const smsLogPayload = {
          booking_id:   booking.id,
          customer_id:  booking.customer_id,
          phone_number: booking.customer.phone,
          message_body: template.body,
          sms_type:     'confirmation',
          provider:     '46elks',
          status:       'pending',
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (service as any)
          .from('sms_logs')
          .insert(smsLogPayload)
          .select('id')
          .single()

        if (!error) {
          console.log(`[sms:approve] sms_log inserted id=${(data as { id: string }).id}`)
          return (data as { id: string }).id
        }

        if (error.code !== '23505') {
          console.error('[sms:approve] Failed to insert sms_log:', error.code, error.message)
          return null
        }
        console.warn('[sms:approve] Duplicate sms_log (23505), checking for stale pending...')

        // Unique violation — check for stale pending row
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (service as any)
          .from('sms_logs')
          .select('id, status, created_at')
          .eq('booking_id', booking.id)
          .eq('sms_type', 'confirmation')
          .neq('status', 'failed')
          .maybeSingle()

        // A stale pending row means the process died between send and log-update —
        // the SMS may or may not have been delivered. Mark it 'unknown' so it
        // blocks further automatic sends and requires manual reconciliation.
        const staleThresholdMs = 5 * 60 * 1000
        const isStale = existing?.status === 'pending'
          && existing.created_at
          && (Date.now() - new Date(existing.created_at).getTime()) > staleThresholdMs

        if (isStale) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (service as any)
            .from('sms_logs')
            .update({ status: 'unknown', error_message: 'stale pending — delivery unknown, manual check required' })
            .eq('id', existing.id)
          console.warn('[sms] Stale pending row found for booking', booking.id, '— marked unknown, skipping resend')
        }

        return null  // skip resend in all 23505 cases
      })()

      if (!logId) {
        console.warn('[sms:approve] No logId — aborting SMS send')
        return
      }
      console.log(`[sms:approve] Calling 46elks for logId=${logId}...`)

      const result = await sendBookingConfirmedSms(
        {
          phone:        booking.customer.phone,
          customerName: booking.customer.full_name ?? '—',
          serviceType:  booking.service_type,
          scheduledAt:  booking.scheduled_at,
        },
        template.body,
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: logUpdateError } = await (service as any)
        .from('sms_logs')
        .update({
          message_body:        result.message || template.body,
          status:              result.sent ? 'sent' : 'failed',
          provider_message_id: result.messageId ?? null,
          sent_at:             result.sent ? new Date().toISOString() : null,
          error_message:       result.error ?? null,
        })
        .eq('id', logId)

      console.log(`[sms:approve] 46elks result: sent=${result.sent} messageId=${result.messageId} error=${result.error}`)

      if (logUpdateError) {
        console.error('[sms:approve] Failed to update sms_log after send:', logUpdateError.message)
      }

      if (result.sent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: bookingFlagError } = await (service as any)
          .from('bookings')
          .update({ sms_confirmation_sent: true })
          .eq('id', body.bookingId)

        if (bookingFlagError) {
          console.error('[sms] Failed to set sms_confirmation_sent:', bookingFlagError.message)
        }
      }
    })()
  }

  return NextResponse.json({ status: newStatus })
}
