import type { Account } from './api/users'

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
