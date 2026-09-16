import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, isUserRole } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, readJsonObject } from '@/lib/api'

// PATCH /api/workers/[id] { role?, is_active? } — admin only.
// Guards: an admin cannot edit their own account here, and the last active
// administrator can never be demoted or deactivated (that would lock everyone out).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(['admin'])
  if (!auth.ok) return auth.response
  const { profile } = auth
  const { id } = await params

  if (id === profile.id) return jsonError('Du kan inte ändra ditt eget konto härifrån', 403)

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const { role, is_active } = body
  if (role !== undefined && !isUserRole(role))              return jsonError('Ogiltig roll', 400)
  if (is_active !== undefined && typeof is_active !== 'boolean') return jsonError('is_active måste vara true/false', 400)
  if (role === undefined && is_active === undefined)        return jsonError('Inga fält att uppdatera', 400)

  const service = createServiceClient()

  const { data: target, error: targetErr } = await service
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', id)
    .maybeSingle()

  if (targetErr) return jsonError(targetErr.message, 500)
  if (!target)   return jsonError('Anställd hittades inte', 404)

  const losesAdmin = target.role === 'admin' && target.is_active
    && ((role !== undefined && role !== 'admin') || is_active === false)

  if (losesAdmin) {
    const { count } = await service
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true)
    if ((count ?? 0) <= 1) return jsonError('Det måste finnas minst en aktiv administratör', 409)
  }

  const patch: { role?: string; is_active?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (role !== undefined)      patch.role = role
  if (is_active !== undefined) patch.is_active = is_active

  const { data, error } = await service
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return jsonError(error.message, 500)

  return NextResponse.json(data)
}
