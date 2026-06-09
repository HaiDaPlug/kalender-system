import { NextRequest, NextResponse } from 'next/server'
import { createRawClient } from '@/lib/supabase/server-raw'
import { createServiceClient } from '@/lib/supabase/service'

// PATCH /api/workers/[id] — update role or active status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sessionClient = await createRawClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can change roles or deactivate employees
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: actor } = await (sessionClient as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }
    if (actor?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await request.json() as { role?: string; is_active?: boolean }
  const allowed = ['worker', 'manager', 'admin']

  if (body.role !== undefined && !allowed.includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const patch: { role?: string; is_active?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (body.role !== undefined) patch.role = body.role
  if (body.is_active !== undefined) patch.is_active = body.is_active

  // Use service client so RLS is bypassed — works in both dev (no user) and prod
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createServiceClient() as any)
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
