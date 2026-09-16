import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Service-role client: bypasses RLS. Use only in server-side API routes, and
// only after the caller's identity and role have been verified (see
// src/lib/auth/session.ts) or when acting on behalf of an external system
// (GHL webhooks, which authenticate via signature instead).
//
// Supabase now issues secret keys as `sb_secret_...` (SUPABASE_SECRET_KEY);
// older projects still use the JWT-style service role key. Accept either.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase service client is not configured (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY)')
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type ServiceClient = ReturnType<typeof createServiceClient>
