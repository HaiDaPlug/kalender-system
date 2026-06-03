import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const status = searchParams.get('status')
  const workerId = searchParams.get('worker_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('bookings')
    .select('*, customer:customers(*), car:cars(*), assigned_worker:profiles(*), cleaning_job:cleaning_jobs(*)')
    .order('scheduled_at', { ascending: true })

  if (status) query = query.eq('status', status)
  if (workerId) query = query.eq('assigned_worker_id', workerId)
  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('bookings')
    .insert(body)
    .select('*, customer:customers(*), car:cars(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
