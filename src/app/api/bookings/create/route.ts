import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, isReviewer } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingSubmitted } from '@/lib/email/resend'
import { normalisePhone } from '@/lib/sms/46elks'
import { sendConfirmationSms } from '@/lib/sms/confirmation'
import { jsonError, readJsonObject, isIsoDate, isNonEmptyString, isPositiveInt } from '@/lib/api'

/*
  POST /api/bookings/create
  Creates (or reuses) customer + car, then the booking, then sends the SMS confirmation.

  - Workers: status is forced to 'pending' and the admin is notified by email.
  - Admin/manager: status defaults to 'confirmed'. If the confirmation SMS cannot be
    sent, the booking is reverted to 'pending' so it never looks confirmed when the
    customer was never told.
  - Customers are matched on phone number (normalised to E.164 first, so
    "070-123 45 67" and "+46701234567" are the same customer).
  - Cars are matched on registration number within the customer, so repeat visits
    don't create duplicate car rows.
*/

function normalisePlate(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-]/g, '')
}

function unique<T>(values: (T | null | undefined)[]): T[] {
  return [...new Set(values.filter((v): v is T => v !== null && v !== undefined))]
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { profile } = auth

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const {
    customerName,
    customerPhone,
    customerEmail,
    carMake,
    carModel,
    carPlate,
    carColor,
    scheduledAt,
    estimatedDurationMinutes = 60,
    serviceType,
    assignedWorkerId,
    status,
    totalPrice,
    customerNotes,
  } = body

  if (!isNonEmptyString(customerName) || !isNonEmptyString(customerPhone) || !isNonEmptyString(carMake) || !isNonEmptyString(carModel)) {
    return jsonError('Obligatoriska fält saknas (kund, telefon, bilmärke, modell)', 400)
  }
  if (!isIsoDate(scheduledAt))                     return jsonError('Ogiltig tidpunkt', 400)
  if (!isNonEmptyString(serviceType))               return jsonError('Tjänst krävs', 400)
  if (!isPositiveInt(estimatedDurationMinutes))     return jsonError('Längden måste vara ett positivt antal minuter', 400)
  if (assignedWorkerId !== undefined && assignedWorkerId !== null && typeof assignedWorkerId !== 'string') {
    return jsonError('Ogiltig ansvarig', 400)
  }
  if (totalPrice !== undefined && totalPrice !== null && !(typeof totalPrice === 'number' && Number.isFinite(totalPrice) && totalPrice >= 0)) {
    return jsonError('Priset måste vara ett positivt tal', 400)
  }
  if (customerEmail !== undefined && customerEmail !== null && typeof customerEmail !== 'string') {
    return jsonError('Ogiltig e-post', 400)
  }

  const caller = { id: profile.id, full_name: profile.full_name, email: profile.email }
  const isWorker = !isReviewer(profile.role)

  let finalStatus: 'pending' | 'confirmed' = 'confirmed'
  if (isWorker) {
    finalStatus = 'pending'
  } else if (status === 'pending' || status === 'confirmed') {
    finalStatus = status
  } else if (status !== undefined && status !== null) {
    return jsonError('Status måste vara pending eller confirmed', 400)
  }

  const supabase = createServiceClient()

  // 1. Customer — reuse if the phone number is already known
  const rawPhone = customerPhone.trim()
  const e164 = normalisePhone(rawPhone)
  const storedPhone = e164 ?? rawPhone
  const phoneCandidates = unique([rawPhone, e164])

  let customerId: string
  const { data: existingCustomers, error: lookupErr } = await supabase
    .from('customers')
    .select('id')
    .in('phone', phoneCandidates)
    .order('created_at', { ascending: true })
    .limit(1)

  if (lookupErr) return jsonError(lookupErr.message, 500)

  if (existingCustomers && existingCustomers.length > 0) {
    customerId = existingCustomers[0].id
  } else {
    const { data: newCustomer, error: customerErr } = await supabase
      .from('customers')
      .insert({
        full_name: customerName.trim(),
        phone:     storedPhone,
        email:     isNonEmptyString(customerEmail) ? customerEmail.trim() : null,
      })
      .select('id')
      .single()

    if (customerErr || !newCustomer) {
      return jsonError(customerErr?.message ?? 'Kund kunde inte skapas', 500)
    }
    customerId = newCustomer.id
  }

  // 2. Car — reuse the customer's car with the same registration number
  const plate = isNonEmptyString(carPlate) ? normalisePlate(carPlate) : null
  let carId: string | null = null

  if (plate) {
    const { data: existingCars } = await supabase
      .from('cars')
      .select('id')
      .eq('customer_id', customerId)
      .in('license_plate', unique([plate, carPlate as string, (carPlate as string).toUpperCase()]))
      .limit(1)
    if (existingCars && existingCars.length > 0) carId = existingCars[0].id
  }

  if (!carId) {
    const { data: car, error: carErr } = await supabase
      .from('cars')
      .insert({
        customer_id:   customerId,
        make:          carMake.trim(),
        model:         carModel.trim(),
        license_plate: plate,
        color:         isNonEmptyString(carColor) ? carColor.trim() : null,
      })
      .select('id')
      .single()

    if (carErr || !car) {
      return jsonError(carErr?.message ?? 'Bil kunde inte skapas', 500)
    }
    carId = car.id
  }

  // 3. Booking
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      customer_id:                customerId,
      car_id:                     carId,
      assigned_worker_id:         isNonEmptyString(assignedWorkerId) ? assignedWorkerId : null,
      status:                     finalStatus,
      created_by:                 caller.id,
      scheduled_at:               new Date(scheduledAt).toISOString(),
      estimated_duration_minutes: estimatedDurationMinutes,
      service_type:               serviceType.trim(),
      customer_notes:             isNonEmptyString(customerNotes) ? customerNotes.trim() : null,
      total_price:                typeof totalPrice === 'number' ? totalPrice : null,
      sms_confirmation_sent:      false,
      sms_ready_for_pickup_sent:  false,
    })
    .select('id')
    .single()

  if (bookingErr || !booking) {
    return jsonError(bookingErr?.message ?? 'Bokning kunde inte skapas', 500)
  }

  // 4. Worker submission → notify admin (fire-and-forget, never throws)
  if (isWorker) {
    void sendBookingSubmitted({
      bookingId:    booking.id,
      customerName: customerName.trim(),
      carMake:      carMake.trim(),
      carModel:     carModel.trim(),
      licensePlate: plate ?? undefined,
      serviceType:  serviceType.trim(),
      scheduledAt:  scheduledAt,
      workerName:   caller.full_name,
      workerEmail:  caller.email,
    })
  }

  // 5. SMS confirmation — only for reviewer-created confirmed bookings
  let smsSent = false
  let smsError: string | null = null
  let resultStatus: 'pending' | 'confirmed' = finalStatus

  if (!isWorker && finalStatus === 'confirmed') {
    const sms = await sendConfirmationSms(supabase, {
      bookingId:    booking.id,
      customerId,
      phone:        storedPhone,
      customerName: customerName.trim(),
      serviceType:  serviceType.trim(),
      scheduledAt,
    }, '[sms:create]')
    smsSent = sms.sent
    smsError = sms.error

    // Don't leave the booking looking confirmed if the customer never got the SMS.
    if (!smsSent) {
      const { error: revertError } = await supabase
        .from('bookings')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', booking.id)

      if (revertError) {
        console.error('[sms:create] failed to revert booking to pending after SMS failure:', revertError.message)
      } else {
        resultStatus = 'pending'
      }
    }
  } else {
    console.log(`[sms:create] booking=${booking.id} — SMS skipped (isWorker=${isWorker} status=${finalStatus})`)
  }

  return NextResponse.json({ bookingId: booking.id, status: resultStatus, smsSent, smsError }, { status: 201 })
}
