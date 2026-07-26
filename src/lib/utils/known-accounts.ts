const STORAGE_KEY = 'known-accounts'
const MAX_ACCOUNTS = 6

export interface KnownAccount {
  email: string
  fullName: string
  role: string
}

export function getKnownAccounts(): KnownAccount[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function rememberAccount(account: KnownAccount): void {
  if (typeof window === 'undefined') return
  const existing = getKnownAccounts().filter(a => a.email !== account.email)
  const next = [account, ...existing].slice(0, MAX_ACCOUNTS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function forgetAccount(email: string): void {
  if (typeof window === 'undefined') return
  const next = getKnownAccounts().filter(a => a.email !== email)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
