import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { CalendarView } from '@/components/calendar/calendar-view'
import type { Booking, Profile } from '@/types'

// Only the columns the calendar actually renders. The previous `*` joins pulled
// full customer / car / profile rows for every booking on every visit.
const CALENDAR_SELECT = [
  'id', 'customer_id', 'car_id', 'assigned_worker_id', 'created_by', 'status',
  'scheduled_at', 'estimated_duration_minutes', 'service_type', 'service_notes',
  'customer_notes', 'location_address', 'total_price', 'calendar_color',
  'sms_confirmation_sent', 'sms_ready_for_pickup_sent', 'created_at', 'updated_at',
  'customer:customers(id, full_name, phone, email)',
  'car:cars(id, make, model, license_plate, color)',
  'assigned_worker:profiles!bookings_assigned_worker_id_fkey(id, full_name)',
  'creator:profiles!bookings_created_by_fkey(id, full_name)',
  'cleaning_job:cleaning_jobs(id, status)',
].join(', ')

export default async function CalendarPage() {
  const session = await getSession()
  if (!session.ok) redirect('/login')
  const { supabase } = session

  const [{ data: bookings }, { data: workers }] = await Promise.all([
    supabase
      .from('bookings')
      .select(CALENDAR_SELECT)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
  ])

  return (
    <div className="-m-2 md:-m-6 flex flex-col flex-1 min-h-0">
      {/* CalendarView reads ?new=1 via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <CalendarView
          bookings={(bookings ?? []) as unknown as Booking[]}
          workers={(workers ?? []) as unknown as Profile[]}
        />
      </Suspense>
    </div>
  )
}
