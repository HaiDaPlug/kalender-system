import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'
import { createServiceClient } from '@/lib/supabase/service'
import { sendRawSms } from '@/lib/sms/46elks'

export async function POST(request: NextRequest) {
  const sessionClient = await createRawClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: actor } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'manager'].includes((actor as { role: string } | null)?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { bookingId, message } = await request.json()
  if (!bookingId || !message) {
    return NextResponse.json({ error: 'bookingId and message are required' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: booking } = await service
    .from('bookings')
    .select('*, customer:customers(*)')
    .eq('id', bookingId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const customer = (booking as { customer?: { phone?: string } }).customer
  const customerId = (booking as { customer_id?: string }).customer_id

  if (!customer?.phone) {
    return NextResponse.json({ error: 'Customer has no phone number' }, { status: 400 })
  }

  const result = await sendRawSms(customer.phone, message)

  const { error: logErr } = await service.from('sms_logs').insert({
    booking_id:          bookingId,
    customer_id:         customerId,
    phone_number:        customer.phone,
    message_body:        message,
    sms_type:            'manual',
    provider:            '46elks',
    status:              result.sent ? 'sent' : 'failed',
    provider_message_id: result.messageId ?? null,
    sent_at:             result.sent ? new Date().toISOString() : null,
    error_message:       result.error ?? null,
  })

  if (logErr) {
    console.error('[sms:send] Failed to insert sms_log:', logErr.message)
  }

  if (result.sent) {
    const { error: flagErr } = await service
      .from('bookings')
      .update({ sms_confirmation_sent: true })
      .eq('id', bookingId)
    if (flagErr) {
      console.error('[sms:send] Failed to set sms_confirmation_sent:', flagErr.message)
    }
  }

  if (!result.sent) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ sent: true, messageId: result.messageId })
}
