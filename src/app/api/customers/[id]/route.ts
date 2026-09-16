import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, REVIEWER_ROLES } from '@/lib/auth/session'
import { jsonError, readJsonObject, pickAllowed, isNullableString, isNonEmptyString } from '@/lib/api'
import type { Database } from '@/types/database'

/*
  GET   /api/customers/[id] — full customer profile with bookings, cars, SMS history
  PATCH /api/customers/[id] — update customer notes / contact details (admin & manager)
*/

const PATCHABLE = ['notes', 'full_name', 'email', 'phone', 'address'] as const

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth
  const { id } = await params

  const [customerRes, bookingsRes, smsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle(),

    supabase
      .from('bookings')
      .select('*, car:cars(*), assigned_worker:profiles!bookings_assigned_worker_id_fkey(*)')
      .eq('customer_id', id)
      .order('scheduled_at', { ascending: false }),

    // sms_logs is admin-only under RLS; other roles simply get an empty list.
    supabase
      .from('sms_logs')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (customerRes.error) return jsonError(customerRes.error.message, 500)
  if (!customerRes.data) return jsonError('Kund hittades inte', 404)

  return NextResponse.json({
    customer: customerRes.data,
    bookings: bookingsRes.data ?? [],
    smsLogs:  smsRes.data ?? [],
  })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser(REVIEWER_ROLES)
  if (!auth.ok) return auth.response
  const { supabase } = auth
  const { id } = await params

  const body = await readJsonObject(request)
  if (!body) return jsonError('Ogiltig JSON', 400)

  const patch = pickAllowed(body, PATCHABLE)
  if (Object.keys(patch).length === 0) return jsonError('Inga fält att uppdatera', 400)

  const update: Database['public']['Tables']['customers']['Update'] = { updated_at: new Date().toISOString() }

  for (const key of ['notes', 'email', 'address'] as const) {
    if (key in patch) {
      const value = patch[key]
      if (!isNullableString(value)) return jsonError(`${key} måste vara text eller null`, 400)
      update[key] = value?.trim() || null
    }
  }
  if ('full_name' in patch) {
    if (!isNonEmptyString(patch.full_name)) return jsonError('Namn krävs', 400)
    update.full_name = patch.full_name.trim()
  }
  if ('phone' in patch) {
    if (!isNonEmptyString(patch.phone)) return jsonError('Telefon krävs', 400)
    update.phone = patch.phone.trim()
  }

  const { data, error } = await supabase
    .from('customers')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return jsonError(error.message, 400)
  if (!data) return jsonError('Kund hittades inte eller får inte ändras', 404)

  return NextResponse.json(data)
}
