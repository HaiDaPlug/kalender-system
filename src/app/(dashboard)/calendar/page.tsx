import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CalendarView } from '@/components/calendar/calendar-view'
import type { Booking, Profile } from '@/types'

export default async function CalendarPage() {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()

  // When auth is bypassed in proxy.ts there is no session, so RLS on the anon
  // client returns no rows. Fall back to the service-role client in local dev
  // only — never in production, where an unauthenticated visitor must not read
  // all calendar data.
  const isDev = process.env.NODE_ENV === 'development'
  const supabase = user ? sessionClient : isDev ? createServiceClient() : sessionClient

  const [{ data: bookings }, { data: workers }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, customer:customers(*), car:cars(*), assigned_worker:profiles(*), cleaning_job:cleaning_jobs(*)')
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .in('role', ['worker', 'manager', 'admin']),
  ])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CalendarView
        bookings={(bookings ?? []) as Booking[]}
        workers={(workers ?? []) as Profile[]}
      />
    </div>
  )
}
