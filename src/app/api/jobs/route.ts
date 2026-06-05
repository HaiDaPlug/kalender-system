import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'

// GET /api/jobs[?booking_id=] — lista alla jobb
export async function GET(request: NextRequest) {
  const supabase = await createRawClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bookingId = request.nextUrl.searchParams.get('booking_id')

  let query = supabase
    .from('cleaning_jobs')
    .select(`
      *,
      booking:bookings(
        id, scheduled_at, service_type,
        customer:customers(full_name),
        car:cars(make, model, license_plate)
      ),
      worker:profiles(id, full_name),
      images:job_images(id, public_url, type, created_at)
    `)
    .order('created_at', { ascending: false })

  if (bookingId) query = query.eq('booking_id', bookingId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/jobs — skapa nytt jobb kopplat till en bokning
export async function POST(request: NextRequest) {
  const supabase = await createRawClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { booking_id, worker_id } = body

  if (!booking_id || !worker_id) {
    return NextResponse.json({ error: 'booking_id och worker_id krävs' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cleaning_jobs')
    .insert({ booking_id, worker_id, status: 'not_started' })
    .select(`
      *,
      booking:bookings(id, scheduled_at, service_type,
        customer:customers(full_name),
        car:cars(make, model, license_plate)
      ),
      worker:profiles(id, full_name),
      images:job_images(id, public_url, type, created_at)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
