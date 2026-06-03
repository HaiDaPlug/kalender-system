import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import type { Profile } from '@/types'

const DEV_PROFILE: Profile = {
  id: 'dev',
  email: 'hai@khyteteam.com',
  full_name: 'Hai Pham Bui',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={DEV_PROFILE} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar profile={DEV_PROFILE} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  )
}
