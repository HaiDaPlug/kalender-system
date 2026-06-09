import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/me — returns the current user's profile (role, name, etc.)
// Falls back to service client in dev when auth is bypassed.
export async function GET() {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  const isDev = process.env.NODE_ENV === 'development'

  if (!user && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user && isDev) {
    // Return the dev admin profile so UI behaves as admin in development
    return NextResponse.json({ role: 'admin', full_name: 'Dev Admin', id: 'dev' })
  }

  const supabase = user ? sessionClient : createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, email, phone')
    .eq('id', user!.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
