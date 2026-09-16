import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSession, isReviewer } from '@/lib/auth/session'
import { businessDayRange, BUSINESS_TZ } from '@/lib/time'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardStats } from '@/components/dashboard/dashboard-stats'
import { TodaySchedule } from '@/components/dashboard/today-schedule'
import { RecentBookings } from '@/components/dashboard/recent-bookings'
import { PendingShiftsBanner } from '@/components/shifts/pending-shifts-banner'
import { PendingBookingsBanner } from '@/components/bookings/pending-bookings-banner'
import type { Booking } from '@/types'

const LIST_SELECT =
  '*, customer:customers(*), car:cars(*), assigned_worker:profiles!bookings_assigned_worker_id_fkey(*), creator:profiles!bookings_created_by_fkey(*)'

function greeting(now: Date): string {
  const hour = Number(now.toLocaleString('sv-SE', { hour: '2-digit', hour12: false, timeZone: BUSINESS_TZ }))
  if (hour < 10) return 'God morgon'
  if (hour < 17) return 'God dag'
  return 'God kväll'
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.ok) redirect('/login')
  const { supabase, profile } = session

  const reviewer = isReviewer(profile.role)
  const now = new Date()
  const { start, end } = businessDayRange(now)
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  const [todayRes, pendingRes, activeJobsRes, completedRes, recentRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(LIST_SELECT)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('cleaning_jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['in_progress', 'needs_review']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso),
    supabase
      .from('bookings')
      .select(LIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const todayBookings = (todayRes.data ?? []) as unknown as Booking[]
  const recentBookings = (recentRes.data ?? []) as unknown as Booking[]

  const dateLabel = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: BUSINESS_TZ })
  const firstName = profile.full_name.split(' ')[0] || profile.full_name

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        subtitle={<span className="capitalize">{dateLabel}</span>}
        actions={
          <Link href="/calendar?new=1" className="btn btn-primary btn-sm">
            <Plus />
            Ny bokning
          </Link>
        }
      />

      <DashboardStats
        stats={[
          { label: 'Bokningar idag',     value: todayBookings.length,  href: '/calendar',           color: 'var(--status-confirmed)' },
          { label: 'Väntar godkännande', value: pendingRes.count ?? 0, href: '/dashboard#pending',  color: 'var(--status-pending)' },
          { label: 'Pågående jobb',      value: activeJobsRes.count ?? 0, href: '/jobs',            color: 'var(--status-in-progress)' },
          { label: 'Klart idag',         value: completedRes.count ?? 0,  href: '/jobs',            color: 'var(--status-completed)' },
        ]}
      />

      {reviewer && (
        <div id="pending" className="space-y-4 scroll-mt-6">
          <PendingBookingsBanner reviewerId={profile.id} />
          <PendingShiftsBanner reviewerId={profile.id} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3 min-w-0">
          <TodaySchedule bookings={todayBookings} dateLabel={dateLabel} />
        </div>
        <div className="xl:col-span-2 min-w-0">
          <RecentBookings bookings={recentBookings} />
        </div>
      </div>
    </div>
  )
}
