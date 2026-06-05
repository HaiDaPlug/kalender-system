import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { RecentBookings } from '@/components/dashboard/recent-bookings'
import { PendingShiftsBanner } from '@/components/shifts/pending-shifts-banner'

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <DashboardStats totalBookings={0} activeJobs={0} completedToday={0} />
      {/* Väntande pass — visas för admin/manager, döljer sig om inga finns */}
      <PendingShiftsBanner />
      <RecentBookings bookings={[]} />
    </div>
  )
}
