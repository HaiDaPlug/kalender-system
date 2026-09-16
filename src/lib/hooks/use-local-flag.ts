'use client'

import { useCallback, useSyncExternalStore } from 'react'

const CHANGE_EVENT = 'local-flag-change'

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

/*
  A boolean persisted in localStorage, read through useSyncExternalStore so it
  hydrates without a setState-in-effect and stays in sync across tabs.
  Server-rendered as `false`; the real value takes over right after hydration.
*/
export function useLocalFlag(key: string): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => false)

  const setValue = useCallback((next: boolean) => {
    try {
      localStorage.setItem(key, String(next))
    } catch {
      // storage unavailable — ignore, the flag just won't persist
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [key])

  return [value, setValue]
}
