'use client'

import { useSyncExternalStore } from 'react'

// Matches Tailwind's `md` breakpoint: below it we are on a phone.
const NARROW_QUERY = '(max-width: 767px)'

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(NARROW_QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  return window.matchMedia(NARROW_QUERY).matches
}

/*
  True on narrow (phone) screens. Server-rendered as false; the real value
  takes over right after hydration (via useSyncExternalStore, so no
  setState-in-effect).
*/
export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
