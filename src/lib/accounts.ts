import { useEffect, useState } from 'react'
import { usersApi, type Account } from './api/users'

/** Active accounts, loaded once. Empty while loading or offline. */
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  useEffect(() => {
    const ctrl = new AbortController()
    usersApi
      .list(ctrl.signal)
      .then(setAccounts)
      .catch(() => {
        // Offline: players just aren't linked to accounts.
      })
    return () => ctrl.abort()
  }, [])
  return accounts
}

/** The account a typed player name belongs to (display name or username, any case). */
export function accountFor(name: string, accounts: Account[]): Account | null {
  const n = name.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!n) return null
  return (
    accounts.find((a) => a.displayName.toLowerCase() === n) ??
    accounts.find((a) => a.username === n) ??
    null
  )
}
