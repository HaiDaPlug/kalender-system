'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
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

    const { error } = await supabase.auth.signInWithPassword({ email, password })
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
        .single()
      const p = profile as { full_name: string; role: string } | null
      rememberAccount({ email, fullName: p?.full_name ?? email, role: p?.role ?? 'worker' })
    }

    setEntering(true)
    router.refresh()
    setTimeout(() => router.push('/dashboard'), 700)
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
    <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded p-7">
      <div className="text-center space-y-1 mb-1">
        <p className="text-sm font-medium text-foreground">Logga in på arbetsportalen</p>
      </div>
      {error && (
        <div className="rounded bg-destructive/10 text-destructive text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="email">E-post</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          placeholder="din@epost.se"
        />
      </div>
      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="password">Lösenord</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-primary text-primary-foreground py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loggar in…' : 'Logga in'}
      </button>
    </form>
  )
}
