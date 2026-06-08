import { createClient } from '@/lib/supabase/server'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { RecentBookings } from '@/components/dashboard/recent-bookings'
import { PendingShiftsBanner } from '@/components/shifts/pending-shifts-banner'
import type { Profile } from '@/types'

// Dev placeholder — matches layout.tsx, removed once auth is enabled
const DEV_PROFILE: Profile = {
  id: 'dev',
  email: 'hai@khyteteam.com',
  full_name: 'Hai Pham Bui',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile = DEV_PROFILE
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) profile = data as Profile
  }

  const isReviewer = profile.role === 'admin' || profile.role === 'manager'

  return (
    <div className="space-y-5">
      <DashboardStats totalBookings={0} activeJobs={0} completedToday={0} />
      {/* Only show pending shifts banner to admin/manager — workers should not see or act on others' shifts */}
      {isReviewer && <PendingShiftsBanner reviewerId={user ? profile.id : undefined} />}
      <RecentBookings bookings={[]} />
    </div>
  )
}
