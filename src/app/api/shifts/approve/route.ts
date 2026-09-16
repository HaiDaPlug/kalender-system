import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, REVIEWER_ROLES } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, readJsonObject, isNonEmptyString } from '@/lib/api'

/*
  POST /api/shifts/approve   { shiftId, action: 'approved' | 'rejected' }
  Admin/manager approves or rejects a pending shift. The reviewer is always the
  signed-in user — the request body cannot choose who approved.
*/
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(REVIEWER_ROLES)
  if (!auth.ok) return auth.response
  const { profile } = auth

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const { shiftId, action } = body
  if (!isNonEmptyString(shiftId) || (action !== 'approved' && action !== 'rejected')) {
    return jsonError('shiftId och action (approved/rejected) krävs', 400)
  }

  const service = createServiceClient()

  const { data: shift, error: fetchError } = await service
    .from('shifts')
    .select('id, status')
    .eq('id', shiftId)
    .maybeSingle()

  if (fetchError) return jsonError(fetchError.message, 500)
  if (!shift)     return jsonError('Passet hittades inte', 404)
  if (shift.status !== 'pending') return jsonError('Passet väntar inte på godkännande', 409)

  const now = new Date().toISOString()
  const { data, error } = await service
    .from('shifts')
    .update({
      status:      action,
      reviewed_by: profile.id,
      reviewed_at: now,
      updated_at:  now,
    })
    .eq('id', shiftId)
    .eq('status', 'pending')
    .select('*, worker:profiles!shifts_worker_id_fkey(*)')
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data)  return jsonError('Passet har redan hanterats', 409)

  return NextResponse.json(data)
}
