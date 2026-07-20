import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar/calendar-view'
import type { Booking, Profile } from '@/types'

export default async function CalendarPage() {
  const supabase = await createClient()

  const [{ data: bookings }, { data: workers }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, customer:customers(*), car:cars(*), assigned_worker:profiles!bookings_assigned_worker_id_fkey(*), cleaning_job:cleaning_jobs(*)')
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .in('role', ['worker', 'manager', 'admin']),
  ])

  return (
    <div className="-m-6 flex flex-col flex-1 min-h-0">
      <CalendarView
        bookings={(bookings ?? []) as unknown as Booking[]}
        workers={(workers ?? []) as Profile[]}
      />
    </div>
  )
}
