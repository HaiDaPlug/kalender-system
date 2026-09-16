import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, readJsonObject, isNonEmptyString } from '@/lib/api'

const MAX_BODY_CHARS = 600

// GET /api/sms-templates — the single active template (any signed-in staff)
export async function GET() {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const { data, error } = await supabase
    .from('sms_templates')
    .select('id, name, body, is_active, updated_at')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data)  return jsonError('Ingen aktiv mall konfigurerad', 404)

  // The sender id customers see on their phone (46elks alphanumeric sender).
  return NextResponse.json({ ...data, sender: process.env.FORTYSIX_ELKS_FROM ?? 'KOMFORT' })
}

// PATCH /api/sms-templates { id, body } — update the active template (admin only)
export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser(['admin'])
  if (!auth.ok) return auth.response

  const json = await readJsonObject(request)
  if (!json) return jsonError('Ogiltig JSON', 400)

  const { id, body } = json
  if (!isNonEmptyString(id) || !isNonEmptyString(body)) return jsonError('id och body krävs', 400)
  if (body.trim().length > MAX_BODY_CHARS) return jsonError(`Mallen får vara högst ${MAX_BODY_CHARS} tecken`, 400)

  const service = createServiceClient()
  const { data, error } = await service
    .from('sms_templates')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, body, updated_at')
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data)  return jsonError('Mallen hittades inte', 404)

  return NextResponse.json(data)
}
