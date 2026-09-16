import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { MyShiftsView } from '@/components/shifts/my-shifts-view'

// Server shell: resolves the signed-in user, the client view does the rest.
export default async function MyShiftsPage() {
  const session = await getSession()
  if (!session.ok) redirect('/login')

  return (
    <MyShiftsView
      currentUser={{ id: session.profile.id, full_name: session.profile.full_name }}
    />
  )
}
