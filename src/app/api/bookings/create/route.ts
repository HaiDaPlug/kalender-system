import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRawClient } from '@/lib/supabase/server-raw'
import { ghlConversations } from '@/lib/gohighlevel/client'
import { sendBookingSubmitted } from '@/lib/email/resend'

/*
  POST /api/bookings/create
  Creates customer (reuse if phone exists) + car + booking in sequence, then sends SMS confirmation.
  If the caller is a worker, status is forced to 'pending' and an approval email is sent to the admin.
*/
export async function POST(request: NextRequest) {
  const supabase = await createRawClient()
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

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

  const isWorker = !['admin', 'manager'].includes(callerProfile?.role ?? 'admin')
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
  try {
    const date = new Date(scheduledAt)
    const dateStr = date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })

    const message = `Hej ${customerName}! Din bokning är bekräftad: ${serviceType} ${dateStr} kl ${timeStr}. Välkommen!`

    // Hämta GHL contact ID om kunden finns i HighLevel
    const { data: customerData } = await supabase
      .from('customers')
      .select('highlevel_contact_id')
      .eq('id', customerId)
      .single()

    if (customerData?.highlevel_contact_id && process.env.GHL_LOCATION_ID) {
      await ghlConversations.sendMessage({
        type: 'SMS',
        contactId: customerData.highlevel_contact_id,
        locationId: process.env.GHL_LOCATION_ID,
        message,
      })

      await supabase.from('sms_logs').insert({
        booking_id: booking.id,
        customer_id: customerId,
        phone_number: customerPhone,
        message_body: message,
        sms_type: 'confirmation',
        status: 'sent',
        provider: 'highlevel',
        sent_at: new Date().toISOString(),
      })

      await supabase
        .from('bookings')
        .update({ sms_confirmation_sent: true })
        .eq('id', booking.id)

      smsSent = true
    }
  } catch {
    // SMS-fel stoppar inte bokningen — logga tyst
  }

  return NextResponse.json({ bookingId: booking.id, smsSent }, { status: 201 })
}
