import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, REVIEWER_ROLES } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingApproved, sendBookingRejected } from '@/lib/email/resend'
import { sendConfirmationSms } from '@/lib/sms/confirmation'
import { jsonError, readJsonObject, isNonEmptyString } from '@/lib/api'

/*
  POST /api/bookings/approve   { bookingId, action: 'approved' | 'rejected', reason? }
  Admin/manager approves or rejects a *pending* booking.

  approve: status → confirmed, SMS to customer. If the SMS fails the booking is
           reverted to pending (and the worker is NOT emailed "approved").
  reject:  status → cancelled, email to the submitting worker with optional reason.
*/

interface BookingForApproval {
  id: string
  status: string
  customer_id: string
  service_type: string
  scheduled_at: string
  customer: { full_name: string; phone: string | null } | null
  car: { make: string; model: string; license_plate: string | null } | null
  creator: { full_name: string; email: string } | null
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(REVIEWER_ROLES)
  if (!auth.ok) return auth.response

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const { bookingId, action, reason } = body
  if (!isNonEmptyString(bookingId) || (action !== 'approved' && action !== 'rejected')) {
    return jsonError('bookingId och action (approved/rejected) krävs', 400)
  }
  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    return jsonError('Ogiltig anledning', 400)
  }

  const service = createServiceClient()

  const { data: raw, error: fetchError } = await service
    .from('bookings')
    .select('id, status, customer_id, service_type, scheduled_at, customer:customers(full_name, phone), car:cars(make, model, license_plate), creator:profiles!bookings_created_by_fkey(full_name, email)')
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchError) return jsonError(fetchError.message, 500)
  if (!raw)       return jsonError('Bokningen hittades inte', 404)

  const booking = raw as unknown as BookingForApproval

  if (booking.status !== 'pending') {
    return jsonError('Bokningen väntar inte på godkännande', 409)
  }

  const newStatus = action === 'approved' ? 'confirmed' : 'cancelled'

  const { error: updateError } = await service
    .from('bookings')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('status', 'pending') // guard against a concurrent approve/reject

  if (updateError) return jsonError(updateError.message, 500)

  // Confirmation SMS to the customer on approval
  let smsSent = false
  let smsError: string | null = null
  let finalStatus: string = newStatus

  if (action === 'approved') {
    const sms = await sendConfirmationSms(service, {
      bookingId:    booking.id,
      customerId:   booking.customer_id,
      phone:        booking.customer?.phone,
      customerName: booking.customer?.full_name ?? '—',
      serviceType:  booking.service_type,
      scheduledAt:  booking.scheduled_at,
    }, '[sms:approve]')
    smsSent = sms.sent
    smsError = sms.error

    if (!smsSent) {
      const { error: revertError } = await service
        .from('bookings')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', bookingId)

      if (revertError) {
        console.error('[sms:approve] failed to revert booking to pending after SMS failure:', revertError.message)
      } else {
        finalStatus = 'pending'
      }
    }
  }

  // Email the worker who submitted it — only once the outcome is final, so a
  // reverted approval never sends a misleading "approved" email.
  if (booking.creator?.email) {
    const emailData = {
      bookingId:    booking.id,
      customerName: booking.customer?.full_name ?? '—',
      carMake:      booking.car?.make ?? '—',
      carModel:     booking.car?.model ?? '—',
      licensePlate: booking.car?.license_plate ?? undefined,
      serviceType:  booking.service_type,
      scheduledAt:  booking.scheduled_at,
      workerName:   booking.creator.full_name,
      workerEmail:  booking.creator.email,
    }

    if (action === 'rejected') {
      void sendBookingRejected({ ...emailData, reason: isNonEmptyString(reason) ? reason.trim() : undefined })
    } else if (finalStatus === 'confirmed') {
      void sendBookingApproved(emailData)
    }
  }

  return NextResponse.json({ status: finalStatus, smsSent, smsError })
}
