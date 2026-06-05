import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'

// GET /api/jobs/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createRawClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('cleaning_jobs')
    .select(`
      *,
      booking:bookings(
        id, scheduled_at, service_type, location_address,
        customer:customers(full_name, phone),
        car:cars(make, model, license_plate, color)
      ),
      worker:profiles(id, full_name),
      images:job_images(id, public_url, type, created_at, uploaded_by)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/jobs/[id] — uppdatera status, noter etc
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createRawClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const allowed = ['status', 'worker_notes', 'admin_notes', 'started_at', 'completed_at']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (body.status === 'in_progress' && !patch.started_at) {
    patch.started_at = new Date().toISOString()
  }
  if (body.status === 'completed' && !patch.completed_at) {
    patch.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('cleaning_jobs')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
