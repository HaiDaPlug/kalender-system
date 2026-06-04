import { NextResponse } from 'next/server'

// Auth bypassed for local development — replace with updateSession when ready.
export function proxy() {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
