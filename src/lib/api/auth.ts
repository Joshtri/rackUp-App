import { request } from './client'

export type User = {
  id: string
  username: string
  displayName: string
  /** Epoch ms */
  createdAt: number
  /** Epoch ms when the account stops working. */
  expiresAt: number
}

export type AuthSession = {
  token: string
  /** Epoch ms when the token stops working (never after `user.expiresAt`). */
  expiresAt: number
  user: User
}

export const authApi = {
  login: (username: string, password: string) =>
    request<AuthSession>('POST', '/auth/login', { body: { username, password }, auth: false }),

  /** Validates the stored token and returns the current account. */
  me: (signal?: AbortSignal) => request<User>('GET', '/auth/me', { signal }),
}
