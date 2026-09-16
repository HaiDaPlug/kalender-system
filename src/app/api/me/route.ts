import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth/session'

// GET /api/me — the current user's profile (id, role, name, email, phone).
// 401 when signed out, 403 when the account is deactivated or has no profile row.
export async function GET() {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  const { profile } = auth
  return NextResponse.json({
    id:        profile.id,
    full_name: profile.full_name,
    role:      profile.role,
    email:     profile.email,
    phone:     profile.phone,
  })
}
