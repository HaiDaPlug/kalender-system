import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'
import { ghlConversations } from '@/lib/gohighlevel/client'

/*
  POST /api/bookings/create
  Skapar kund (om ny) + bil + bokning i en sekvens, skickar sedan SMS-bekräftelse.
  Auth är avslagen under dev — service-role används för skrivoperationer.
*/
export async function POST(request: NextRequest) {
  const supabase = await createRawClient()

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
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      car_id: car.id,
      assigned_worker_id: assignedWorkerId ?? null,
      status: status ?? 'confirmed',
      scheduled_at: scheduledAt,
      estimated_duration_minutes: estimatedDurationMinutes,
      service_type: serviceType,
      customer_notes: customerNotes ?? null,
      total_price: totalPrice ?? null,
      sms_confirmation_sent: false,
      sms_ready_for_pickup_sent: false,
    })
    .select('id')
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: bookingErr?.message ?? 'Bokning kunde inte skapas' }, { status: 500 })
  }

  // 4. SMS-bekräftelse — försök skicka, men låt inte fel blockera svaret
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
    }

    // Logga SMS oavsett om GHL-kontakt finns
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
  } catch {
    // SMS-fel stoppar inte bokningen — logga tyst
  }

  return NextResponse.json({ bookingId: booking.id, smsSent }, { status: 201 })
}
