'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { rememberAccount } from '@/lib/utils/known-accounts'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [entering, setEntering] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError('Fel e-post eller lösenord')
      toast.error('Inloggning misslyckades', { description: error.message })
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()
      rememberAccount({ email: email.trim(), fullName: profile?.full_name ?? email, role: profile?.role ?? 'worker' })
    }

    setEntering(true)
    router.refresh()
    setTimeout(() => router.push('/dashboard'), 600)
  }

  if (entering) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-spin [animation-duration:0.8s]" />
        </div>
        <p className="text-sm text-muted-foreground tracking-wide">Loggar in…</p>
      </div>
    )
  }

  return (
    <div className="animate-scale-in">
      {/* Brand */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="brand-mark brand-mark-lg" aria-hidden>K</div>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">KOM-fort Bilvård</p>
          <p className="text-sm text-muted-foreground mt-0.5">Logga in på arbetsportalen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/12 border border-destructive/30 text-destructive text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="label-caps" htmlFor="email">E-post</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="field"
            placeholder="din@epost.se"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps" htmlFor="password">Lösenord</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="field"
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block mt-2">
          {loading ? <Loader2 className="animate-spin" /> : null}
          {loading ? 'Loggar in…' : 'Logga in'}
          {!loading && <ArrowRight />}
        </button>
      </form>
    </div>
  )
}
