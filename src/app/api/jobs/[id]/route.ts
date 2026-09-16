import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, isReviewer } from '@/lib/auth/session'
import { jsonError, readJsonObject, pickAllowed, isNullableString, isIsoDate } from '@/lib/api'
import type { CleaningJobStatus } from '@/types'
import type { Database } from '@/types/database'

const JOB_STATUSES: readonly CleaningJobStatus[] = ['not_started', 'in_progress', 'needs_review', 'completed']

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/jobs/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth
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
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError('Jobbet hittades inte', 404)
  return NextResponse.json(data)
}

/*
  PATCH /api/jobs/[id] — status, notes, timestamps.
  Workers may only update their own job and cannot approve it (status=completed)
  or write admin_notes; those are reviewer actions.
*/
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase, profile } = auth
  const { id } = await params

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const patch = pickAllowed(body, ['status', 'worker_notes', 'admin_notes', 'started_at', 'completed_at'] as const)
  if (Object.keys(patch).length === 0) return jsonError('Inga fält att uppdatera', 400)

  const update: Database['public']['Tables']['cleaning_jobs']['Update'] = {}

  if ('status' in patch) {
    if (!(JOB_STATUSES as readonly string[]).includes(patch.status as string)) return jsonError('Ogiltig status', 400)
    update.status = patch.status as CleaningJobStatus
  }
  for (const key of ['worker_notes', 'admin_notes'] as const) {
    if (key in patch) {
      const value = patch[key]
      if (!isNullableString(value)) return jsonError(`${key} måste vara text eller null`, 400)
      update[key] = value?.trim() || null
    }
  }
  for (const key of ['started_at', 'completed_at'] as const) {
    if (key in patch) {
      const value = patch[key]
      if (value !== null && !isIsoDate(value)) return jsonError(`${key} måste vara ett datum`, 400)
      update[key] = value === null ? null : new Date(value).toISOString()
    }
  }

  const reviewer = isReviewer(profile.role)

  const { data: job, error: jobErr } = await supabase
    .from('cleaning_jobs')
    .select('id, worker_id, status')
    .eq('id', id)
    .maybeSingle()

  if (jobErr) return jsonError(jobErr.message, 500)
  if (!job)   return jsonError('Jobbet hittades inte', 404)

  if (!reviewer) {
    if (job.worker_id !== profile.id)   return jsonError('Du kan bara uppdatera dina egna jobb', 403)
    if ('admin_notes' in update)        return jsonError('Endast admin kan skriva granskningskommentar', 403)
    if (update.status === 'completed')  return jsonError('Endast admin kan godkänna ett jobb', 403)
    if (job.status === 'completed')     return jsonError('Jobbet är redan godkänt', 409)
  }

  if (update.status === 'in_progress' && !update.started_at) {
    update.started_at = new Date().toISOString()
  }
  if (update.status === 'completed' && !update.completed_at) {
    update.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('cleaning_jobs')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError('Jobbet kunde inte uppdateras', 404)
  return NextResponse.json(data)
}
