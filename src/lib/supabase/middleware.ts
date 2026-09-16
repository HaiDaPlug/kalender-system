import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/*
  Runs in the proxy for every non-static request.

  Pages:   verify the session (network call to Supabase Auth) and redirect
           signed-out visitors to /login. This is also where an expired access
           token gets refreshed and the new cookies written.
  API:     every route handler verifies the caller itself via requireApiUser()
           (src/lib/auth/session.ts), which also refreshes tokens. Doing the same
           network lookup here as well doubled the auth cost of every API call,
           so for /api/* we only fast-fail requests that carry no auth cookie at
           all and otherwise let the handler do the real check.
  Webhooks: exempt — they authenticate with their own signature.
*/

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isWebhookRoute = pathname.startsWith('/api/webhooks')
  const isApiRoute = pathname.startsWith('/api')

  if (isWebhookRoute) {
    return NextResponse.next({ request })
  }

  if (isApiRoute) {
    if (!hasSupabaseAuthCookie(request)) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicRoute = pathname === '/' || isAuthRoute

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Signed-in users hitting /login are normally bounced to /dashboard — except when
  // they arrive via the account switcher (?email=...), which needs /login to actually
  // render so they can sign out and back in as a different account.
  const isAccountSwitch = pathname.startsWith('/login') && request.nextUrl.searchParams.has('email')
  if (user && isAuthRoute && !isAccountSwitch) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
