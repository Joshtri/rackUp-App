import { request } from './client'

/** Another account, as listed by `GET /users`. */
export type Account = {
  id: string
  username: string
  displayName: string
}

export const usersApi = {
  /** Active accounts, for linking a session's players to them. */
  list: (signal?: AbortSignal) => request<Account[]>('GET', '/users', { signal }),
}
