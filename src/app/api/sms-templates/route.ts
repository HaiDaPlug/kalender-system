import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/sms-templates — returns the single active template (auth required)
export async function GET() {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('sms_templates')
    .select('id, name, body, is_active, updated_at')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'No active template configured' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PATCH /api/sms-templates — updates the body of the active template (admin only)
// Body: { id: string; body: string }
export async function PATCH(request: NextRequest) {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'
  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const { id, body } = await request.json() as { id: string; body: string }

  if (!id || !body?.trim()) {
    return NextResponse.json({ error: 'id and body required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('sms_templates')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, body, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
