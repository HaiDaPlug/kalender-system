import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/workers
// ?all=true  → include inactive employees (for staff management page)
// default    → only active employees (for assignment dropdowns)
export async function GET(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = user ? sessionClient : createServiceClient()
  const includeAll = request.nextUrl.searchParams.get('all') === 'true'

  let query = supabase
    .from('profiles')
    .select('id, full_name, role, email, phone, is_active, created_at')
    .in('role', ['worker', 'manager', 'admin'])
    .order('full_name', { ascending: true })

  if (!includeAll) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/workers — invite a new employee via Supabase Auth, then set their profile data.
// Flow: inviteUserByEmail creates an auth.users row → DB trigger creates profiles row →
// we update the profile with name/role/phone. This avoids the FK violation from inserting
// directly into profiles with a random UUID that has no matching auth.users row.
export async function POST(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can create employees
  if (user) {
    const { data: actor } = await sessionClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if ((actor as { role: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await request.json() as {
    full_name: string
    email: string
    role: string
    phone?: string
  }

  if (!body.full_name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: 'Namn och e-post krävs' }, { status: 400 })
  }

  const allowed = ['worker', 'manager']
  if (!allowed.includes(body.role)) {
    return NextResponse.json({ error: 'Ogiltig roll' }, { status: 400 })
  }

  const service = createServiceClient()

  // Step 1: invite via Auth — sends a signup email to the employee
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    body.email.trim().toLowerCase(),
    { data: { full_name: body.full_name.trim(), role: body.role } }
  )

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  const authUserId = invited.user.id

  // Step 2: upsert the profile row with correct name/role/phone.
  // The DB trigger may have already created the row; upsert handles both cases.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (service as any)
    .from('profiles')
    .upsert({
      id: authUserId,
      full_name: body.full_name.trim(),
      email: body.email.trim().toLowerCase(),
      role: body.role,
      phone: body.phone?.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json(profile, { status: 201 })
}
