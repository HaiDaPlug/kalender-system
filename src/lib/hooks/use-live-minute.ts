'use client'

import { useSyncExternalStore } from 'react'

const TICK_MS = 15_000

function subscribe(callback: () => void): () => void {
  const id = setInterval(callback, TICK_MS)
  return () => clearInterval(id)
}

function getSnapshot(): number {
  return Math.floor(Date.now() / 60_000)
}

/*
  The current minute as a number (minutes since epoch), re-rendering only when
  the minute changes. Returns 0 during server rendering / hydration so the UI
  can render a placeholder without a hydration mismatch.
*/
export function useLiveMinute(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
