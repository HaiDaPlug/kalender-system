'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ShieldOff, UserX, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  reason: 'inactive' | 'no_profile'
}

const COPY = {
  inactive: {
    icon: ShieldOff,
    title: 'Kontot är avaktiverat',
    text: 'Ditt konto har stängts av. Kontakta din administratör om du tror att det är ett misstag.',
  },
  no_profile: {
    icon: UserX,
    title: 'Kontot saknar en profil',
    text: 'Inloggningen fungerade, men det finns ingen personalprofil kopplad till kontot. Be en administratör att lägga till dig under Personal.',
  },
} as const

/*
  Rendered by the dashboard layout instead of redirecting when a signed-in user
  may not use the portal. Redirecting to /login would bounce straight back to
  /dashboard (the proxy sends signed-in users away from /login), so we show the
  reason and a real sign-out button instead.
*/
export function AccountBlocked({ reason }: Props) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const { icon: Icon, title, text } = COPY[reason]

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="auth-backdrop min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="card w-full max-w-sm p-7 text-center space-y-5 animate-scale-in">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/12 border border-destructive/30 flex items-center justify-center">
          <Icon className="h-5 w-5 text-destructive" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
        </div>
        <button onClick={() => void handleSignOut()} disabled={signingOut} className="btn btn-secondary btn-block">
          {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
          Logga ut
        </button>
      </div>
    </div>
  )
}
