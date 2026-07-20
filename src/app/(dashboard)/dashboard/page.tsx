import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { RecentBookings } from '@/components/dashboard/recent-bookings'
import { PendingShiftsBanner } from '@/components/shifts/pending-shifts-banner'
import { PendingBookingsBanner } from '@/components/bookings/pending-bookings-banner'
import type { Profile } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!data) redirect('/login')

  const profile = data as Profile
  const isReviewer = profile.role === 'admin' || profile.role === 'manager'

  return (
    <div className="space-y-5">
      <DashboardStats totalBookings={0} activeJobs={0} completedToday={0} />
      {/* Only show pending banners to admin/manager */}
      {isReviewer && <PendingBookingsBanner reviewerId={profile.id} />}
      {isReviewer && <PendingShiftsBanner reviewerId={profile.id} />}
      <RecentBookings bookings={[]} />
    </div>
  )
}
