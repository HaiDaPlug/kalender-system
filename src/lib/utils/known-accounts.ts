const STORAGE_KEY = 'known-accounts'
const CHANGE_EVENT = 'known-accounts-change'
const MAX_ACCOUNTS = 6

export interface KnownAccount {
  email: string
  fullName: string
  role: string
}

function readRaw(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeRaw(accounts: KnownAccount[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // Storage unavailable (private mode, quota) — the switcher just won't remember.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function parseKnownAccounts(raw: string): KnownAccount[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (a): a is KnownAccount => !!a && typeof a === 'object' && typeof (a as KnownAccount).email === 'string',
    )
  } catch {
    return []
  }
}

export function getKnownAccounts(): KnownAccount[] {
  return parseKnownAccounts(readRaw())
}

export function rememberAccount(account: KnownAccount): void {
  const existing = getKnownAccounts().filter(a => a.email !== account.email)
  writeRaw([account, ...existing].slice(0, MAX_ACCOUNTS))
}

export function forgetAccount(email: string): void {
  writeRaw(getKnownAccounts().filter(a => a.email !== email))
}

/*
  For useSyncExternalStore: the raw JSON string is the snapshot (strings compare
  by value, so React only re-renders when the stored list actually changes).
*/
export function getKnownAccountsSnapshot(): string {
  return readRaw()
}

export function getKnownAccountsServerSnapshot(): string {
  return ''
}

export function subscribeKnownAccounts(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
