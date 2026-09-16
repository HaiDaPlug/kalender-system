import 'server-only'

import { cache } from 'react'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

/*
  Single source of truth for "who is calling?" on the server.

  Every API route and server page goes through here instead of re-implementing
  the auth.getUser() + profiles lookup + role check dance. This also enforces the
  two rules that were previously unenforced anywhere:
    - a deactivated employee (profiles.is_active = false) is treated as signed out
    - an auth user with no profiles row is rejected instead of half-working
*/

export const REVIEWER_ROLES: readonly UserRole[] = ['admin', 'manager']
export const ALL_ROLES: readonly UserRole[] = ['admin', 'manager', 'worker']

export interface SessionProfile {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
}

export type SessionFailure =
  | { ok: false; status: 401; reason: 'unauthenticated'; error: string }
  | { ok: false; status: 403; reason: 'no_profile' | 'inactive'; error: string }

export interface SessionSuccess {
  ok: true
  user: User
  profile: SessionProfile
  supabase: Awaited<ReturnType<typeof createClient>>
}

export type SessionResult = SessionSuccess | SessionFailure

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value)
}

export function isReviewer(role: UserRole): boolean {
  return REVIEWER_ROLES.includes(role)
}

/*
  Wrapped in React's cache() so the dashboard layout and the page it renders
  share ONE auth round trip + ONE profiles query per request instead of each
  doing their own.
*/
export const getSession = cache(async function getSession(): Promise<SessionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401, reason: 'unauthenticated', error: 'Unauthorized' }
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!data || !isUserRole(data.role)) {
    return { ok: false, status: 403, reason: 'no_profile', error: 'Kontot saknar en profil' }
  }

  if (!data.is_active) {
    return { ok: false, status: 403, reason: 'inactive', error: 'Kontot är avaktiverat' }
  }

  return {
    ok: true,
    user,
    supabase,
    profile: {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: data.role,
      is_active: data.is_active,
    },
  }
})

export type ApiAuthResult =
  | (SessionSuccess & { response?: undefined })
  | { ok: false; response: NextResponse }

/*
  For route handlers. Returns either the session or a ready-to-return JSON
  error response (401 unauthenticated, 403 wrong role / inactive / no profile).

    const auth = await requireApiUser(REVIEWER_ROLES)
    if (!auth.ok) return auth.response
    const { profile, supabase } = auth
*/
export async function requireApiUser(roles?: readonly UserRole[]): Promise<ApiAuthResult> {
  const session = await getSession()

  if (!session.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: session.error }, { status: session.status }),
    }
  }

  if (roles && !roles.includes(session.profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return session
}
