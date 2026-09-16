import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, readJsonObject, pickAllowed, isIsoDate, isNonEmptyString, isPositiveInt, isNullableNumber, isNullableString } from '@/lib/api'
import type { BookingStatus } from '@/types'
import type { Database } from '@/types/database'

const BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

// Columns an admin may change from the booking detail page. Everything else
// (created_by, sms flags, HighLevel ids, customer/car links) is server-owned.
const PATCHABLE = [
  'status',
  'scheduled_at',
  'estimated_duration_minutes',
  'service_type',
  'assigned_worker_id',
  'total_price',
  'customer_notes',
  'service_notes',
  'location_address',
  'calendar_color',
] as const

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/bookings/[id]
export async function GET(_: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('bookings')
    .select('*, customer:customers(*), car:cars(*), assigned_worker:profiles!bookings_assigned_worker_id_fkey(*), creator:profiles!bookings_created_by_fkey(*), cleaning_job:cleaning_jobs(*, worker:profiles(*))')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(`[booking:get] id=${id} error=${error.code} ${error.message}`)
    return jsonError(error.message, 500)
  }
  if (!data) return jsonError('Bokningen hittades inte', 404)

  return NextResponse.json(data)
}

// PATCH /api/bookings/[id] — admin only, allow-listed columns, validated.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser(['admin'])
  if (!auth.ok) return auth.response
  const { supabase } = auth
  const { id } = await params

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const patch = pickAllowed(body, PATCHABLE)
  if (Object.keys(patch).length === 0) return jsonError('Inga fält att uppdatera', 400)

  // Validate each allowed field and copy it into a typed update object.
  const update: Database['public']['Tables']['bookings']['Update'] = { updated_at: new Date().toISOString() }

  if ('status' in patch) {
    if (!(BOOKING_STATUSES as readonly string[]).includes(patch.status as string)) return jsonError('Ogiltig status', 400)
    update.status = patch.status as BookingStatus
  }
  if ('scheduled_at' in patch) {
    if (!isIsoDate(patch.scheduled_at)) return jsonError('Ogiltig tidpunkt', 400)
    update.scheduled_at = new Date(patch.scheduled_at).toISOString()
  }
  if ('estimated_duration_minutes' in patch) {
    if (!isPositiveInt(patch.estimated_duration_minutes)) return jsonError('Längden måste vara ett positivt antal minuter', 400)
    update.estimated_duration_minutes = patch.estimated_duration_minutes
  }
  if ('service_type' in patch) {
    if (!isNonEmptyString(patch.service_type)) return jsonError('Tjänst krävs', 400)
    update.service_type = patch.service_type.trim()
  }
  if ('assigned_worker_id' in patch) {
    if (!isNullableString(patch.assigned_worker_id)) return jsonError('Ogiltig ansvarig', 400)
    update.assigned_worker_id = patch.assigned_worker_id || null
  }
  if ('total_price' in patch) {
    if (!isNullableNumber(patch.total_price)) return jsonError('Priset måste vara ett tal', 400)
    update.total_price = patch.total_price
  }
  for (const key of ['customer_notes', 'service_notes', 'location_address', 'calendar_color'] as const) {
    if (key in patch) {
      const value = patch[key]
      if (!isNullableString(value)) return jsonError(`${key} måste vara text eller null`, 400)
      update[key] = value
    }
  }

  // Session client: RLS (bookings_update_admin) is a second line of defence.
  const { data, error } = await supabase
    .from('bookings')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return jsonError(error.message, 400)
  if (!data) return jsonError('Bokningen hittades inte eller får inte ändras', 404)

  return NextResponse.json(data)
}

// DELETE /api/bookings/[id] — admin only.
// Uses the service client after the role check so the delete does not silently
// no-op when the DB lacks a delete policy, and detaches SMS logs first (they
// reference bookings without cascade, which used to make deletes fail).
export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser(['admin'])
  if (!auth.ok) return auth.response
  const { id } = await params

  const service = createServiceClient()

  const { data: existing, error: lookupError } = await service
    .from('bookings')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (lookupError) return jsonError(lookupError.message, 500)
  if (!existing)   return jsonError('Bokningen hittades inte', 404)

  const { error: detachError } = await service
    .from('sms_logs')
    .update({ booking_id: null })
    .eq('booking_id', id)

  if (detachError) return jsonError(`Kunde inte koppla loss SMS-loggar: ${detachError.message}`, 500)

  const { data: deleted, error } = await service
    .from('bookings')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return jsonError(error.message, 400)
  if (!deleted || deleted.length === 0) return jsonError('Bokningen kunde inte tas bort', 409)

  return new NextResponse(null, { status: 204 })
}
