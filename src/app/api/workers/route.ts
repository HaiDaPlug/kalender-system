import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, readJsonObject, isNonEmptyString } from '@/lib/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/workers
// ?all=true → include inactive employees (staff management page)
// default   → only active employees (assignment dropdowns)
// RLS decides visibility: admin/manager see everyone, staff see only themselves.
export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const includeAll = request.nextUrl.searchParams.get('all') === 'true'

  let query = supabase
    .from('profiles')
    .select('id, full_name, role, email, phone, is_active, created_at')
    .order('full_name', { ascending: true })

  if (!includeAll) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return jsonError(error.message, 500)

  return NextResponse.json(data ?? [])
}

// POST /api/workers — invite a new employee via Supabase Auth, then set their profile data.
// Flow: inviteUserByEmail creates the auth.users row → DB trigger creates the profiles
// row → we upsert the profile with name/role/phone. Admin only.
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if (!auth.ok) return auth.response

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const { full_name, email, role, phone } = body

  if (!isNonEmptyString(full_name) || !isNonEmptyString(email)) return jsonError('Namn och e-post krävs', 400)
  const cleanEmail = email.trim().toLowerCase()
  if (!EMAIL_RE.test(cleanEmail)) return jsonError('Ogiltig e-postadress', 400)
  if (role !== 'worker' && role !== 'manager') return jsonError('Ogiltig roll', 400)
  if (phone !== undefined && phone !== null && typeof phone !== 'string') return jsonError('Ogiltigt telefonnummer', 400)

  const service = createServiceClient()

  const { data: existing } = await service
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()
  if (existing) return jsonError('Det finns redan ett konto med den e-postadressen', 409)

  // Step 1: invite via Auth — sends a signup email to the employee
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    cleanEmail,
    { data: { full_name: full_name.trim(), role } }
  )

  if (inviteError) return jsonError(inviteError.message, 500)

  // Step 2: upsert the profile row with correct name/role/phone.
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .upsert({
      id:         invited.user.id,
      full_name:  full_name.trim(),
      email:      cleanEmail,
      role,
      phone:      isNonEmptyString(phone) ? phone.trim() : null,
      is_active:  true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (profileError) return jsonError(profileError.message, 500)

  return NextResponse.json(profile, { status: 201 })
}
