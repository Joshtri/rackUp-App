import type { Match } from '../matches'
import type { Session } from '../session'
import { syncServerClock } from '../serverClock'
import { request } from './client'

/** A shared shot-clock session as stored on the API. */
export type LiveSession = {
  id: string
  /** The `Session` object, exactly as the last phone saved it. */
  state: Session
  /** Goes up by one on every change. */
  version: number
  createdBy: string | null
  /** Epoch ms, only once the session has ended. */
  endedAt: number | null
  endedBy: string | null
  endedByName: string | null
  /** The match saved when the session ended, if it was saved. */
  savedMatchId: string | null
  createdAt: number
  updatedAt: number
}

type One = { serverNow: number; session?: LiveSession }

/** Calls the API and feeds `serverNow` from the response to the server clock. */
async function timed<T extends { serverNow: number }>(call: () => Promise<T>): Promise<T> {
  const sentAt = Date.now()
  const res = await call()
  syncServerClock(res.serverNow, sentAt, Date.now())
  return res
}

const path = (id: string) => `/live-sessions/${encodeURIComponent(id)}`

export const liveSessionsApi = {
  /** Sessions still running on any phone. */
  active: async (signal?: AbortSignal) =>
    (await timed(() => request<{ serverNow: number; sessions: LiveSession[] }>('GET', '/live-sessions', { signal })))
      .sessions,

  /** Safe to repeat: the same id returns the stored session. */
  create: async (state: Session) =>
    (await timed(() => request<One>('POST', '/live-sessions', { body: { id: state.id, state } }))).session!,

  /** The session, or `undefined` when it is still at version `since`. */
  get: async (id: string, since?: number) =>
    (await timed(() => request<One>('GET', since === undefined ? path(id) : `${path(id)}?since=${since}`)))
      .session,

  /** 409 `conflict` when another phone changed it first, or it has ended. */
  update: async (id: string, version: number, state: Session) =>
    (await timed(() => request<One>('PUT', path(id), { body: { version, state } }))).session!,

  /** Ends the session; `match` is saved in the history (with the session's id), `null` discards it. */
  end: async (id: string, match: Match | null) =>
    (
      await timed(() =>
        request<{ serverNow: number; session: LiveSession; match?: Match }>('POST', `${path(id)}/end`, {
          body: { match },
        }),
      )
    ).session,
}
