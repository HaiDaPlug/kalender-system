import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'

/*
  GET  /api/customers/[id]  — full kundprofil med bokningar, bilar, SMS-historik
  PATCH /api/customers/[id] — uppdatera kundanteckningar
*/

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createRawClient()
  const { id }   = await params

  const [customerRes, bookingsRes, smsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single(),

    supabase
      .from('bookings')
      .select('*, car:cars(*), assigned_worker:profiles(*)')
      .eq('customer_id', id)
      .order('scheduled_at', { ascending: false }),

    supabase
      .from('sms_logs')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (customerRes.error) return NextResponse.json({ error: 'Kund hittades inte' }, { status: 404 })

  return NextResponse.json({
    customer: customerRes.data,
    bookings: bookingsRes.data ?? [],
    smsLogs:  smsRes.data ?? [],
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createRawClient()
  const { id }   = await params
  const body     = await request.json()

  const { data, error } = await supabase
    .from('customers')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
