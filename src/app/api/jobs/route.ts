import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, isReviewer } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, readJsonObject, isNonEmptyString } from '@/lib/api'

const JOB_SELECT = `
  *,
  booking:bookings(
    id, scheduled_at, service_type,
    customer:customers(full_name),
    car:cars(make, model, license_plate)
  ),
  worker:profiles(id, full_name),
  images:job_images(id, public_url, type, created_at)
`

// GET /api/jobs[?booking_id=] — list jobs (RLS: workers see their own, reviewers see all)
export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const bookingId = request.nextUrl.searchParams.get('booking_id')

  let query = supabase
    .from('cleaning_jobs')
    .select(JOB_SELECT)
    .order('created_at', { ascending: false })

  if (bookingId) query = query.eq('booking_id', bookingId)

  const { data, error } = await query
  if (error) return jsonError(error.message, 500)
  return NextResponse.json(data)
}

/*
  POST /api/jobs   { booking_id, worker_id? }
  Creates the cleaning job for a booking (one per booking).

  - Workers always become the job's worker themselves. They may only start a job on
    a booking that is unassigned or assigned to them; an unassigned booking is
    assigned to them at the same time so "Ansvarig" reflects who did the work.
  - Admin/manager may pass worker_id to create the job on someone's behalf;
    otherwise the booking's assigned worker (or they themselves) is used.
  - If the job already exists it is returned with 200 instead of failing.
*/
export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { profile } = auth

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const { booking_id, worker_id } = body
  if (!isNonEmptyString(booking_id)) return jsonError('booking_id krävs', 400)
  if (worker_id !== undefined && worker_id !== null && typeof worker_id !== 'string') {
    return jsonError('Ogiltig worker_id', 400)
  }

  const service = createServiceClient()

  const { data: booking, error: bookingErr } = await service
    .from('bookings')
    .select('id, assigned_worker_id, status')
    .eq('id', booking_id)
    .maybeSingle()

  if (bookingErr) return jsonError(bookingErr.message, 500)
  if (!booking)   return jsonError('Bokningen hittades inte', 404)
  if (booking.status === 'cancelled') return jsonError('Bokningen är avbokad', 409)

  const reviewer = isReviewer(profile.role)
  let workerId: string

  if (reviewer) {
    workerId = isNonEmptyString(worker_id) ? worker_id : (booking.assigned_worker_id ?? profile.id)
  } else {
    if (booking.assigned_worker_id && booking.assigned_worker_id !== profile.id) {
      return jsonError('Bokningen är tilldelad någon annan', 403)
    }
    workerId = profile.id
  }

  // Return the existing job if there already is one (unique on booking_id).
  const { data: existing } = await service
    .from('cleaning_jobs')
    .select(JOB_SELECT)
    .eq('booking_id', booking_id)
    .maybeSingle()

  if (existing) return NextResponse.json(existing)

  const { data, error } = await service
    .from('cleaning_jobs')
    .insert({ booking_id, worker_id: workerId, status: 'not_started' })
    .select(JOB_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: raced } = await service.from('cleaning_jobs').select(JOB_SELECT).eq('booking_id', booking_id).maybeSingle()
      if (raced) return NextResponse.json(raced)
    }
    return jsonError(error.message, 500)
  }

  if (!reviewer && !booking.assigned_worker_id) {
    await service
      .from('bookings')
      .update({ assigned_worker_id: workerId, updated_at: new Date().toISOString() })
      .eq('id', booking_id)
  }

  return NextResponse.json(data, { status: 201 })
}
