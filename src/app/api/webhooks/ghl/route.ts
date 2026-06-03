import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'
import {
  parseWebhookPayload,
  isAppointmentEvent,
  isContactEvent,
  type GHLAppointmentWebhookPayload,
  type GHLContactWebhookPayload,
} from '@/lib/gohighlevel/webhooks'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = await createRawClient()

  let payload
  try {
    payload = parseWebhookPayload(body)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await supabase.from('highlevel_sync_logs').insert({
    entity_type: 'booking',
    entity_id: payload.id,
    highlevel_id: payload.id,
    action: 'webhook_received',
    payload: payload as Record<string, unknown>,
    success: true,
  })

  if (isAppointmentEvent(payload)) {
    await handleAppointmentEvent(payload as GHLAppointmentWebhookPayload, supabase)
  } else if (isContactEvent(payload)) {
    await handleContactEvent(payload as GHLContactWebhookPayload, supabase)
  }

  return NextResponse.json({ received: true })
}

async function handleAppointmentEvent(
  payload: GHLAppointmentWebhookPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  if (payload.type === 'AppointmentDelete') {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('highlevel_appointment_id', payload.id)
    return
  }

  const statusMap: Record<string, string> = {
    confirmed: 'confirmed',
    new: 'pending',
    cancelled: 'cancelled',
    showed: 'completed',
    noshow: 'cancelled',
  }

  await supabase
    .from('bookings')
    .update({
      status: statusMap[payload.status] ?? 'pending',
      scheduled_at: payload.startTime,
    })
    .eq('highlevel_appointment_id', payload.id)
}

async function handleContactEvent(
  payload: GHLContactWebhookPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(' ')

  await supabase
    .from('customers')
    .upsert(
      {
        highlevel_contact_id: payload.id,
        full_name: fullName || 'Unknown',
        email: payload.email,
        phone: payload.phone ?? '',
      },
      { onConflict: 'highlevel_contact_id' }
    )
}
