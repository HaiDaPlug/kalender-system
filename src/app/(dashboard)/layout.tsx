import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import type { Profile } from '@/types'

// Dev placeholder used when no authenticated session exists.
// Remove once auth is enabled in proxy.ts.
const DEV_PROFILE: Profile = {
  id: 'dev',
  email: 'hai@khyteteam.com',
  full_name: 'Hai Pham Bui',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile = DEV_PROFILE
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) profile = data as Profile
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar profile={profile} />
        <main className="flex-1 overflow-hidden p-6 bg-muted/20 flex flex-col min-h-0">
          <div className="page-enter flex flex-col flex-1 min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
