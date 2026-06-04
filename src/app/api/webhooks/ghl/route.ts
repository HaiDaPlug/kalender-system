import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  parseWebhookPayload,
  isAppointmentEvent,
  isContactEvent,
  type GHLAppointmentWebhookPayload,
  type GHLContactWebhookPayload,
} from '@/lib/gohighlevel/webhooks'

// ── Signature verification ────────────────────────────────────────────────
//
// GHL sends one of two signatures depending on which scheme the location uses:
//   X-GHL-Signature  — Ed25519, verified with their raw public key (current)
//   X-WH-Signature   — RSA-SHA256 base64, deprecated, removed 2026-07-01
//
// GHL_WEBHOOK_PUBLIC_KEY must be the raw 32-byte Ed25519 public key, base64-encoded
// (NOT DER/SPKI — WebCrypto 'raw' import expects raw key bytes, not an ASN.1 envelope).
// To get this value: export the key from the GHL developer portal or decode their
// SPKI DER and strip the 12-byte ASN.1 prefix, leaving the 32-byte key body.
//
// Until configured, verification is skipped. The route then relies on the obscure
// URL + service-role RLS bypass being the only consequence of a spoofed call.

async function verifySignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const publicKeyB64 = process.env.GHL_WEBHOOK_PUBLIC_KEY
  if (!publicKeyB64) {
    // Allow skip only in local dev — in production a missing key means misconfiguration.
    if (process.env.NODE_ENV !== 'development') return false
    return true
  }

  const sigHeader = request.headers.get('x-ghl-signature') ?? ''
  if (!sigHeader) return false

  try {
    // GHL_WEBHOOK_PUBLIC_KEY = raw 32-byte Ed25519 public key, base64-encoded
    const publicKeyBytes = Buffer.from(publicKeyB64, 'base64')
    const key = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    )
    const sigBytes = Buffer.from(sigHeader, 'base64')
    const bodyBytes = new TextEncoder().encode(rawBody)
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, sigBytes, bodyBytes)
  } catch {
    return false
  }
}

// ── Idempotency key ───────────────────────────────────────────────────────
//
// GHL does not include a per-delivery ID, so we derive one from the event
// content. The key is: type:entityId:contentHash, where contentHash is a
// SHA-256 of the mutable fields that distinguish one delivery from another.
//
// This means:
//   - A genuine GHL retry (identical payload) → same key → deduplicated.
//   - AppointmentUpdate #1 (status=confirmed) and #2 (status=cancelled) →
//     different content hash → different keys → both processed.
//   - AppointmentCreate and AppointmentUpdate for the same entity →
//     different type prefix → always different keys.
async function buildIdempotencyKey(payload: ReturnType<typeof parseWebhookPayload>): Promise<string> {
  let entityId: string
  let contentFields: unknown

  if (isAppointmentEvent(payload)) {
    const apt = (payload as GHLAppointmentWebhookPayload).appointment
    entityId = apt?.id ?? 'unknown'
    contentFields = {
      status: apt?.appointmentStatus,
      startTime: apt?.startTime,
      endTime: apt?.endTime,
    }
  } else if (isContactEvent(payload)) {
    const c = payload as GHLContactWebhookPayload
    entityId = c.id ?? 'unknown'
    contentFields = { email: c.email, phone: c.phone, firstName: c.firstName, lastName: c.lastName }
  } else {
    entityId = 'unknown'
    contentFields = {}
  }

  const raw = new TextEncoder().encode(JSON.stringify(contentFields))
  const hashBuf = await crypto.subtle.digest('SHA-256', raw)
  const hash = Buffer.from(hashBuf).toString('hex').slice(0, 16)

  return `${payload.type}:${entityId}:${hash}`
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!await verifySignature(request, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let payload
  try {
    payload = parseWebhookPayload(body)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const idempotencyKey = await buildIdempotencyKey(payload)

  const entityId = isAppointmentEvent(payload)
    ? ((payload as GHLAppointmentWebhookPayload).appointment?.id ?? 'unknown')
    : ((payload as GHLContactWebhookPayload).id ?? 'unknown')

  // Insert with success=false first. The unique index only covers success=true rows,
  // so this does not block concurrent retries yet. On success we flip to true —
  // that's when the slot is claimed. If the process crashes before the flip, the
  // row stays false and the next retry can re-insert cleanly.
  const { data: logRow, error: reserveError } = await supabase
    .from('highlevel_sync_logs')
    .insert({
      entity_type: isAppointmentEvent(payload) ? 'booking' : 'customer',
      entity_id: entityId,
      highlevel_id: idempotencyKey,
      action: 'webhook_received',
      payload: payload as Record<string, unknown>,
      success: false,
    })
    .select('id')
    .single()

  if (reserveError) {
    console.error('[ghl-webhook] log insert failed:', reserveError.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  let processError: string | undefined

  try {
    if (isAppointmentEvent(payload)) {
      await handleAppointmentEvent(payload as GHLAppointmentWebhookPayload, supabase)
    } else if (isContactEvent(payload)) {
      await handleContactEvent(payload as GHLContactWebhookPayload, supabase)
    }
  } catch (err) {
    processError = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ghl-webhook] processing failed:', processError)
  }

  if (processError) {
    await supabase
      .from('highlevel_sync_logs')
      .update({ error_message: processError })
      .eq('id', logRow.id)
    return NextResponse.json({ error: processError }, { status: 500 })
  }

  // Flip to success=true — this is when the unique index slot is claimed.
  // A concurrent request racing the same delivery will also have processed it
  // (business ops are idempotent upserts/updates) and will hit a 23505 here,
  // which we swallow: both callers return 200, the data is correct.
  const { error: commitError } = await supabase
    .from('highlevel_sync_logs')
    .update({ success: true })
    .eq('id', logRow.id)

  if (commitError && commitError.code !== '23505') {
    console.error('[ghl-webhook] log commit failed:', commitError.message)
  }

  return NextResponse.json({ received: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAppointmentEvent(payload: GHLAppointmentWebhookPayload, supabase: any) {
  const apt = payload.appointment

  if (payload.type === 'AppointmentDelete') {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('highlevel_appointment_id', apt.id)
    if (error) throw new Error(`Cancel failed: ${error.message}`)
    return
  }

  const statusMap: Record<string, string> = {
    confirmed: 'confirmed',
    new: 'pending',
    cancelled: 'cancelled',
    showed: 'completed',
    noshow: 'cancelled',
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: statusMap[apt.appointmentStatus] ?? 'pending',
      scheduled_at: apt.startTime,
    })
    .eq('highlevel_appointment_id', apt.id)

  if (error) throw new Error(`Update failed: ${error.message}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleContactEvent(payload: GHLContactWebhookPayload, supabase: any) {
  const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(' ')

  const { error } = await supabase
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

  if (error) throw new Error(`Upsert failed: ${error.message}`)
}
