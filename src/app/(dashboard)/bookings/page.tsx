import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { PageHeader } from '@/components/ui/page-header'
import { BookingsTable } from '@/components/booking/bookings-table'
import type { Booking } from '@/types'

// Not linked from the sidebar (the calendar is the primary view), but reachable
// at /bookings as a flat, newest-first list.
export default async function BookingsPage() {
  const session = await getSession()
  if (!session.ok) redirect('/login')

  const { data } = await session.supabase
    .from('bookings')
    .select('*, customer:customers(*), car:cars(*), assigned_worker:profiles!bookings_assigned_worker_id_fkey(*)')
    .order('scheduled_at', { ascending: false })
    .limit(200)

  const bookings = (data ?? []) as unknown as Booking[]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bokningar"
        subtitle={`${bookings.length} senaste bokningarna`}
        actions={
          <Link href="/calendar?new=1" className="btn btn-primary btn-sm">
            <Plus />
            Ny bokning
          </Link>
        }
      />
      <BookingsTable bookings={bookings} />
    </div>
  )
}
