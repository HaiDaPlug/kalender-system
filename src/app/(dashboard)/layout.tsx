import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { AccountBlocked } from '@/components/auth/account-blocked'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session.ok) {
    if (session.reason === 'unauthenticated') redirect('/login')
    // Signed in but not allowed in (deactivated / missing profile): explain instead of looping.
    return <AccountBlocked reason={session.reason} />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={session.profile} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        <main className="main-surface flex-1 overflow-y-auto p-2 md:p-6 flex flex-col min-h-0">
          <div className="page-enter flex flex-col flex-1 min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
