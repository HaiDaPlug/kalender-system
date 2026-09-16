import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, isReviewer } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, readJsonObject, isIsoDate, isNonEmptyString } from '@/lib/api'

/*
  GET  /api/shifts?worker_id=&status=&from=&to=  — list shifts (all staff can read)
  POST /api/shifts { startsAt, endsAt, notes?, workerId? }
       Staff submit a shift for themselves (status pending). Admin/manager may
       pass workerId to register a shift on someone else's behalf.
*/

const SHIFT_SELECT = '*, worker:profiles!shifts_worker_id_fkey(*), reviewed_by_profile:profiles!shifts_reviewed_by_fkey(*)'
const MAX_SHIFT_HOURS = 24

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const { searchParams } = request.nextUrl
  const workerId = searchParams.get('worker_id')
  const status   = searchParams.get('status')
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')

  if (status && !['pending', 'approved', 'rejected'].includes(status)) return jsonError('Ogiltig status', 400)
  if (from && !isIsoDate(from)) return jsonError('Ogiltigt from-datum', 400)
  if (to && !isIsoDate(to))     return jsonError('Ogiltigt to-datum', 400)

  let query = supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .order('starts_at', { ascending: true })

  if (workerId) query = query.eq('worker_id', workerId)
  if (status)   query = query.eq('status', status)
  if (from)     query = query.gte('starts_at', from)
  if (to)       query = query.lte('starts_at', to)

  const { data, error } = await query
  if (error) return jsonError(error.message, 500)

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { profile } = auth

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const { startsAt, endsAt, notes, workerId } = body

  if (!isIsoDate(startsAt) || !isIsoDate(endsAt)) return jsonError('startsAt och endsAt måste vara giltiga tidpunkter', 400)
  if (notes !== undefined && notes !== null && typeof notes !== 'string') return jsonError('Ogiltig kommentar', 400)

  const start = new Date(startsAt)
  const end   = new Date(endsAt)
  if (end <= start) return jsonError('Slutet måste vara efter starten', 400)
  if (end.getTime() - start.getTime() > MAX_SHIFT_HOURS * 3600_000) {
    return jsonError(`Ett pass kan vara högst ${MAX_SHIFT_HOURS} timmar`, 400)
  }

  // Only reviewers may create a shift for someone else.
  let targetWorkerId = profile.id
  if (isNonEmptyString(workerId) && workerId !== profile.id) {
    if (!isReviewer(profile.role)) return jsonError('Du kan bara lägga in pass för dig själv', 403)
    targetWorkerId = workerId
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('shifts')
    .insert({
      worker_id: targetWorkerId,
      starts_at: start.toISOString(),
      ends_at:   end.toISOString(),
      notes:     isNonEmptyString(notes) ? notes.trim() : null,
      status:    'pending',
    })
    .select(SHIFT_SELECT)
    .single()

  if (error) return jsonError(error.message, 400)

  return NextResponse.json(data, { status: 201 })
}
