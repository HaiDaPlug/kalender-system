import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'

/*
  GET  /api/shifts  — hämta pass (filtrera på worker_id, status, from, to)
  POST /api/shifts  — anställd skapar ett nytt pass (status sätts till 'pending')
*/

export async function GET(request: NextRequest) {
  const supabase = await createRawClient()
  const { searchParams } = new URL(request.url)

  const workerId = searchParams.get('worker_id')
  const status   = searchParams.get('status')
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')

  let query = supabase
    .from('shifts')
    .select('*, worker:profiles!shifts_worker_id_fkey(*), reviewed_by_profile:profiles!shifts_reviewed_by_fkey(*)')
    .order('starts_at', { ascending: true })

  if (workerId) query = query.eq('worker_id', workerId)
  if (status)   query = query.eq('status', status)
  if (from)     query = query.gte('starts_at', from)
  if (to)       query = query.lte('starts_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createRawClient()
  const body = await request.json()

  const { workerId, startsAt, endsAt, notes } = body

  if (!workerId || !startsAt || !endsAt) {
    return NextResponse.json({ error: 'workerId, startsAt och endsAt krävs' }, { status: 400 })
  }

  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: 'Slutet måste vara efter starten' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('shifts')
    .insert({
      worker_id: workerId,
      starts_at: startsAt,
      ends_at:   endsAt,
      notes:     notes ?? null,
      status:    'pending',
    })
    .select('*, worker:profiles!shifts_worker_id_fkey(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
