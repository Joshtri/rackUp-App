import { useCallback, useEffect, useState } from 'react'
import { friendsApi, type FriendsOverview } from './api/friends'

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [] }
const REFRESH_MS = 60_000

/**
 * Friends and invitations of the logged-in account. Picks up new invitations
 * when the app comes back to the front and once a minute while it's open.
 *
 * Actions throw ApiError on failure, so the caller can show the message.
 * `onChange` runs after any change that alters what the account can see.
 */
export function useFriends(onChange: () => void) {
  // null until the first load.
  const [loadedOverview, setOverview] = useState<FriendsOverview | null>(null)
  const overview = loadedOverview ?? EMPTY

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await friendsApi.overview(signal)
      setOverview(next)
    } catch {
      // Offline or server trouble: keep what we have, try again later.
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    friendsApi.overview(ctrl.signal).then(setOverview, () => {
      // Offline: the interval below tries again.
    })
    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    const timer = setInterval(onVisible, REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  /** Runs an action, applies the overview it returns, and reports visibility changes. */
  async function run(call: Promise<FriendsOverview>) {
    const before = overview.friends.length
    const next = await call
    setOverview(next)
    if (next.friends.length !== before) onChange()
    return next
  }

  return {
    ...overview,
    loaded: loadedOverview !== null,
    refresh,
    invite: (username: string) => run(friendsApi.invite(username)),
    accept: (requestId: string) => run(friendsApi.accept(requestId)),
    dismiss: (requestId: string) => run(friendsApi.dismiss(requestId)),
    remove: (userId: string) => run(friendsApi.remove(userId)),
  }
}

export type FriendsState = ReturnType<typeof useFriends>
