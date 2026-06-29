import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingSubmitted } from '@/lib/email/resend'
import { sendBookingConfirmedSms } from '@/lib/sms/46elks'

/*
  POST /api/bookings/create
  Creates customer (reuse if phone exists) + car + booking in sequence, then sends SMS confirmation.
  If the caller is a worker, status is forced to 'pending' and an approval email is sent to the admin.
*/
export async function POST(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    customerName,
    customerPhone,
    customerEmail,
    carMake,
    carModel,
    carPlate,
    carColor,
    scheduledAt,
    estimatedDurationMinutes,
    serviceType,
    assignedWorkerId,
    status,
    totalPrice,
    customerNotes,
  } = body

  if (!customerName || !customerPhone || !carMake || !carModel || !scheduledAt) {
    return NextResponse.json({ error: 'Obligatoriska fält saknas' }, { status: 400 })
  }

  // Resolve caller role — workers are forced to pending status
  type CallerProfile = { id: string; full_name: string; email: string; role: string }
  let callerProfile: CallerProfile | null = null
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sessionClient as any)
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .single() as { data: CallerProfile | null }
    if (data) callerProfile = data
  }

  const supabase = createServiceClient()

  const isWorker = !['admin', 'manager'].includes(callerProfile?.role ?? (isDev ? 'admin' : 'worker'))
  const finalStatus: string = isWorker ? 'pending' : (status ?? 'confirmed')

  // 1. Kund — återanvänd om telefonnummer redan finns
  let customerId: string
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', customerPhone)
    .maybeSingle()

  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const { data: newCustomer, error: customerErr } = await supabase
      .from('customers')
      .insert({
        full_name: customerName,
        phone: customerPhone,
        email: customerEmail ?? null,
      })
      .select('id')
      .single()

    if (customerErr || !newCustomer) {
      return NextResponse.json({ error: customerErr?.message ?? 'Kund kunde inte skapas' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  // 2. Bil
  const { data: car, error: carErr } = await supabase
    .from('cars')
    .insert({
      customer_id: customerId,
      make: carMake,
      model: carModel,
      license_plate: carPlate ?? null,
      color: carColor ?? null,
    })
    .select('id')
    .single()

  if (carErr || !car) {
    return NextResponse.json({ error: carErr?.message ?? 'Bil kunde inte skapas' }, { status: 500 })
  }

  // 3. Bokning
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: booking, error: bookingErr } = await (supabase as any)
    .from('bookings')
    .insert({
      customer_id: customerId,
      car_id: car.id,
      assigned_worker_id: assignedWorkerId ?? null,
      status: finalStatus,
      created_by: callerProfile?.id ?? null,
      scheduled_at: scheduledAt,
      estimated_duration_minutes: estimatedDurationMinutes,
      service_type: serviceType,
      customer_notes: customerNotes ?? null,
      total_price: totalPrice ?? null,
      sms_confirmation_sent: false,
      sms_ready_for_pickup_sent: false,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null }

  if (bookingErr || !booking) {
    return NextResponse.json({ error: bookingErr?.message ?? 'Bokning kunde inte skapas' }, { status: 500 })
  }

  // 4. If worker submitted, notify admin via email (fire-and-forget)
  if (isWorker && callerProfile) {
    void sendBookingSubmitted({
      bookingId:    booking.id,
      customerName: customerName as string,
      carMake:      carMake as string,
      carModel:     carModel as string,
      licensePlate: carPlate as string | undefined,
      serviceType:  serviceType as string,
      scheduledAt:  scheduledAt as string,
      workerName:   callerProfile.full_name,
      workerEmail:  callerProfile.email,
    })
  }

  // 5. SMS confirmation — only for admin/manager-created confirmed bookings
  // Workers' pending bookings are not confirmed yet so no SMS is sent
  let smsSent = false
  if (!isWorker && finalStatus === 'confirmed') {
    console.log(`[sms:create] booking=${booking.id} — starting SMS flow`)
    await (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: template, error: templateErr } = await (supabase as any)
        .from('sms_templates')
        .select('body')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (templateErr) {
        console.error('[sms:create] Template fetch error:', templateErr.message)
        return
      }
      if (!template?.body) {
        console.warn('[sms:create] No active template configured — skipping SMS')
        return
      }
      console.log('[sms:create] Template found, inserting sms_log...')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: logRow, error: logErr } = await (supabase as any)
        .from('sms_logs')
        .insert({
          booking_id:   booking.id,
          customer_id:  customerId,
          phone_number: customerPhone as string,
          message_body: template.body,
          sms_type:     'confirmation',
          provider:     '46elks',
          status:       'pending',
        })
        .select('id')
        .single()

      if (logErr || !logRow) {
        console.error('[sms:create] Failed to insert sms_log:', logErr?.message)
        return
      }
      console.log(`[sms:create] sms_log inserted id=${(logRow as { id: string }).id}, calling 46elks...`)

      const result = await sendBookingConfirmedSms(
        {
          phone:        customerPhone as string,
          customerName: customerName as string,
          serviceType:  serviceType as string,
          scheduledAt:  scheduledAt as string,
        },
        template.body,
      )
      console.log(`[sms:create] 46elks result: sent=${result.sent} messageId=${result.messageId} error=${result.error}`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('sms_logs')
        .update({
          message_body:        result.message || template.body,
          status:              result.sent ? 'sent' : 'failed',
          provider_message_id: result.messageId ?? null,
          sent_at:             result.sent ? new Date().toISOString() : null,
          error_message:       result.error ?? null,
        })
        .eq('id', (logRow as { id: string }).id)

      if (result.sent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('bookings')
          .update({ sms_confirmation_sent: true })
          .eq('id', booking.id)
        smsSent = true
      }
    })()
  } else {
    console.log(`[sms:create] booking=${booking.id} — SMS skipped (isWorker=${isWorker} status=${finalStatus})`)
  }

  return NextResponse.json({ bookingId: booking.id, smsSent }, { status: 201 })
}
