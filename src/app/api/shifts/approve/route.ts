import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'

/*
  POST /api/shifts/approve
  Goran (admin/manager) godkänner eller avvisar ett pass.
  Body: { shiftId, action: 'approved' | 'rejected', reviewerId }
*/
export async function POST(request: NextRequest) {
  const supabase = await createRawClient()
  const body = await request.json()

  const { shiftId, action, reviewerId } = body

  if (!shiftId || !action || !reviewerId) {
    return NextResponse.json({ error: 'shiftId, action och reviewerId krävs' }, { status: 400 })
  }

  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'action måste vara approved eller rejected' }, { status: 400 })
  }

  // Verifiera att reviewern är admin eller manager
  const { data: reviewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', reviewerId)
    .single()

  if (!reviewer || !['admin', 'manager'].includes(reviewer.role)) {
    return NextResponse.json({ error: 'Endast admin eller manager kan godkänna pass' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('shifts')
    .update({
      status:      action,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', shiftId)
    .select('*, worker:profiles!shifts_worker_id_fkey(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
