import { request } from './client'
import type { Account } from './users'

export type Friend = Account & {
  /** Epoch ms when the friendship started. */
  since: number
}

export type FriendRequest = {
  id: string
  /** The other side: who sent it (incoming) or who it was sent to (outgoing). */
  user: Account
  createdAt: number
}

/** Every /friends endpoint answers with the whole picture. */
export type FriendsOverview = {
  friends: Friend[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

const enc = encodeURIComponent

export const friendsApi = {
  overview: (signal?: AbortSignal) => request<FriendsOverview>('GET', '/friends', { signal }),

  /** Invite by username. If they already invited you, you become friends right away. */
  invite: (username: string) =>
    request<FriendsOverview>('POST', '/friends/requests', { body: { username } }),

  accept: (requestId: string) =>
    request<FriendsOverview>('POST', `/friends/requests/${enc(requestId)}/accept`),

  /** Decline an incoming invitation, or cancel one you sent. */
  dismiss: (requestId: string) =>
    request<FriendsOverview>('DELETE', `/friends/requests/${enc(requestId)}`),

  remove: (userId: string) => request<FriendsOverview>('DELETE', `/friends/${enc(userId)}`),
}
