import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, REVIEWER_ROLES } from '@/lib/auth/session'
import { jsonError, readJsonObject, isIsoDate, isNonEmptyString, isPositiveInt, isNullableNumber, isNullableString } from '@/lib/api'
import type { BookingStatus } from '@/types'

const BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']

// Route files may only export handlers, so this stays module-local.
const BOOKING_SELECT =
  '*, customer:customers(*), car:cars(*), assigned_worker:profiles!bookings_assigned_worker_id_fkey(*), creator:profiles!bookings_created_by_fkey(*), cleaning_job:cleaning_jobs(*)'

// GET /api/bookings?status=&worker_id=&from=&to=
// Reads go through the session client so RLS applies (all active staff can read bookings).
export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const { searchParams } = request.nextUrl
  const status   = searchParams.get('status')
  const workerId = searchParams.get('worker_id')
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')

  if (status && !(BOOKING_STATUSES as readonly string[]).includes(status)) {
    return jsonError('Ogiltig status', 400)
  }
  if (from && !isIsoDate(from)) return jsonError('Ogiltigt from-datum', 400)
  if (to && !isIsoDate(to))     return jsonError('Ogiltigt to-datum', 400)

  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('scheduled_at', { ascending: true })

  if (status)   query = query.eq('status', status)
  if (workerId) query = query.eq('assigned_worker_id', workerId)
  if (from)     query = query.gte('scheduled_at', from)
  if (to)       query = query.lte('scheduled_at', to)

  const { data, error } = await query
  if (error) return jsonError(error.message, 500)

  return NextResponse.json(data)
}

// POST /api/bookings — low-level insert for an existing customer + car.
// The UI uses /api/bookings/create (which also creates customer/car and sends SMS);
// this endpoint stays for integrations but is now admin/manager-only and validated.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(REVIEWER_ROLES)
  if (!auth.ok) return auth.response
  const { supabase, profile } = auth

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const {
    customer_id, car_id, scheduled_at, service_type,
    estimated_duration_minutes = 60,
    status = 'confirmed',
    assigned_worker_id = null,
    total_price = null,
    customer_notes = null,
    service_notes = null,
    location_address = null,
  } = body

  if (!isNonEmptyString(customer_id) || !isNonEmptyString(car_id)) return jsonError('customer_id och car_id krävs', 400)
  if (!isIsoDate(scheduled_at))            return jsonError('scheduled_at måste vara ett giltigt datum', 400)
  if (!isNonEmptyString(service_type))     return jsonError('service_type krävs', 400)
  if (!isPositiveInt(estimated_duration_minutes)) return jsonError('estimated_duration_minutes måste vara ett positivt heltal', 400)
  if (!(BOOKING_STATUSES as readonly string[]).includes(status as string)) return jsonError('Ogiltig status', 400)
  if (!isNullableString(assigned_worker_id)) return jsonError('assigned_worker_id måste vara en sträng eller null', 400)
  if (!isNullableNumber(total_price))        return jsonError('total_price måste vara ett tal eller null', 400)
  if (!isNullableString(customer_notes) || !isNullableString(service_notes) || !isNullableString(location_address)) {
    return jsonError('Anteckningsfält måste vara text eller null', 400)
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id,
      car_id,
      scheduled_at:               new Date(scheduled_at).toISOString(),
      service_type:               service_type.trim(),
      estimated_duration_minutes,
      status:                     status as BookingStatus,
      assigned_worker_id:         assigned_worker_id || null,
      total_price,
      customer_notes,
      service_notes,
      location_address,
      created_by:                 profile.id,
    })
    .select('*, customer:customers(*), car:cars(*)')
    .single()

  if (error) return jsonError(error.message, 400)

  return NextResponse.json(data, { status: 201 })
}
