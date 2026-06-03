import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'
import { ghlConversations } from '@/lib/gohighlevel/client'

export async function POST(request: NextRequest) {
  const supabase = await createRawClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId, message } = await request.json()
  if (!bookingId || !message) {
    return NextResponse.json({ error: 'bookingId and message are required' }, { status: 400 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, customer:customers(*)')
    .eq('id', bookingId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const customer = (booking as { customer?: { highlevel_contact_id?: string; phone?: string } }).customer
  const customerId = (booking as { customer_id?: string }).customer_id

  if (!customer?.highlevel_contact_id) {
    return NextResponse.json({ error: 'Customer has no HighLevel contact ID' }, { status: 400 })
  }

  let ghlMessageId: string | undefined
  let success = false
  let errorMessage: string | undefined

  try {
    const result = await ghlConversations.sendMessage({
      type: 'SMS',
      contactId: customer.highlevel_contact_id,
      locationId: process.env.GHL_LOCATION_ID!,
      message,
    })
    ghlMessageId = result.message.id
    success = true
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
  }

  await supabase.from('sms_logs').insert({
    booking_id: bookingId,
    customer_id: customerId,
    phone_number: customer.phone ?? '',
    message_body: message,
    status: success ? 'sent' : 'failed',
    highlevel_message_id: ghlMessageId,
    sent_at: success ? new Date().toISOString() : undefined,
    error_message: errorMessage,
  })

  if (success) {
    await supabase
      .from('bookings')
      .update({ sms_confirmation_sent: true })
      .eq('id', bookingId)
  }

  if (!success) {
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }

  return NextResponse.json({ sent: true, messageId: ghlMessageId })
}
