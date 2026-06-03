import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { RecentBookings } from '@/components/dashboard/recent-bookings'

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <DashboardStats totalBookings={0} activeJobs={0} completedToday={0} />
      <RecentBookings bookings={[]} />
    </div>
  )
}
