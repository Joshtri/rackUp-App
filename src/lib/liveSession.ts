/*
 * Shared shot-clock session: the same session on several phones.
 *
 * How it stays in sync:
 * - A tap is applied on this phone right away, and queued.
 * - The queue is sent to the server one tap at a time. Each update says which
 *   version it was based on; if another phone changed the session first, the
 *   server answers 409, we fetch the newer state and apply the tap again on
 *   top of it (taps carry what the phone showed, see `withSeen`, so a button
 *   pressed on two phones at once counts once).
 * - With nothing queued, the phone polls about once a second for changes.
 * - Offline, taps keep queuing and the clock keeps running; the queue is sent
 *   when the connection is back. The queue is saved, so a reload keeps it.
 *
 * Vercel functions can't hold a WebSocket open, hence the polling.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { ApiError, errorMessage } from './api/client'
import { liveSessionsApi, type LiveSession } from './api/liveSessions'
import type { Match } from './matches'
import {
  normalizeSession,
  sessionReducer,
  takeLegacySession,
  withSeen,
  type Session,
  type SessionAction,
} from './session'

type Finish =
  /** End the session for everyone; `match` is saved in the history, `null` discards it. */
  | { kind: 'end'; match: Match | null }
  /** Stop following it on this phone; it keeps going on the others. */
  | { kind: 'leave' }

type Entry = {
  /** Last state confirmed by the server (before the first sync: the starting state). */
  base: Session
  /** Server version of `base`. 0 = not on the server yet. */
  version: number
  /** Taps not confirmed by the server yet, oldest first. */
  pending: SessionAction[]
  finish?: Finish
}

export type SyncStatus = 'synced' | 'syncing' | 'offline'

export type LiveEvent =
  /** Another phone ended the session. */
  | { type: 'endedElsewhere'; session: Session; byName: string | null; saved: boolean }
  /**
   * This phone's end request is done. `error` is set when the server refused
   * it (it won't work on retry either), so the result was not saved.
   */
  | { type: 'ended'; session: Session; savedMatchId: string | null; error?: string }

export type LiveSnapshot = {
  /** The session on screen (server state + this phone's queued taps). */
  session: Session | null
  status: SyncStatus
  /** Not on the server yet, so other phones can't join it. */
  localOnly: boolean
}

const STORAGE_KEY = 'rackup:live-sessions:v1'
const POLL_VISIBLE_MS = 1000
const POLL_HIDDEN_MS = 5000
const MAX_BACKOFF_MS = 8000

// ---------- State ----------

// Declared before `snapshot` below, which uses them as the module loads.
const view = (e: Entry) => e.pending.reduce(sessionReducer, e.base)
const currentEntry = () => entries.find((e) => !e.finish)

let entries: Entry[] = load()
let status: SyncStatus = 'synced'
let snapshot: LiveSnapshot = makeSnapshot()
const listeners = new Set<() => void>()
const eventListeners = new Set<(e: LiveEvent) => void>()

function load(): Entry[] {
  let list: Entry[] = []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(parsed)) {
      list = parsed.flatMap((e: Entry) => {
        const base = normalizeSession(e?.base)
        return base && Array.isArray(e.pending) && Number.isInteger(e.version)
          ? [{ ...e, base }]
          : []
      })
    }
  } catch {
    // Storage blocked or broken: start empty.
  }
  // A session from before sessions were shared carries on as a new shared one.
  const legacy = takeLegacySession()
  if (legacy && !list.some((e) => !e.finish)) list.push({ base: legacy, version: 0, pending: [] })
  return list
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage blocked: the session still works until the tab closes.
  }
}

function makeSnapshot(): LiveSnapshot {
  const e = currentEntry()
  return { session: e ? view(e) : null, status, localOnly: !!e && e.version === 0 }
}

function changed() {
  save()
  snapshot = makeSnapshot()
  for (const l of listeners) l()
}

function setStatus(next: SyncStatus) {
  if (status === next) return
  status = next
  snapshot = makeSnapshot()
  for (const l of listeners) l()
}

const find = (id: string) => entries.find((e) => e.base.id === id)

/** Replaces the entry with this id, if it's still there. */
function patch(id: string, fn: (e: Entry) => Entry) {
  entries = entries.map((e) => (e.base.id === id ? fn(e) : e))
  changed()
}

function remove(id: string) {
  entries = entries.filter((e) => e.base.id !== id)
  changed()
}

function emit(event: LiveEvent) {
  for (const l of eventListeners) l(event)
}

// ---------- Sync loop ----------

/** How many mounted hooks need syncing. */
let running = 0
/** True while `loop` runs; there is only ever one. */
let looping = false
let wakeUp: (() => void) | null = null

function wake() {
  wakeUp?.()
}

/** Waits `ms`, or until `wake()`. */
function idle(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      wakeUp = null
      resolve()
    }
    wakeUp = done
  })
}

const isStatus = (err: unknown, code: number) => err instanceof ApiError && err.status === code

/**
 * The server refused the request itself (bad data, too large): sending it
 * again won't help. Login, missing, conflict and rate-limit errors are
 * handled or retried instead.
 */
const isRefused = (err: unknown) =>
  err instanceof ApiError &&
  err.status >= 400 &&
  err.status < 500 &&
  ![401, 404, 408, 409, 429].includes(err.status)

async function loop() {
  if (looping) return
  looping = true
  try {
    await runLoop()
  } finally {
    looping = false
  }
}

async function runLoop() {
  let failures = 0
  while (running > 0) {
    const entry = entries[0]
    if (!entry) {
      setStatus('synced')
      await idle(60_000)
      continue
    }
    try {
      const pause = await step(entry)
      failures = 0
      if (pause) await idle(pause)
    } catch (err) {
      failures++
      setStatus('offline')
      // Logged out: the app is leaving anyway, don't hammer the server.
      const wait = isStatus(err, 401) ? 30_000 : Math.min(500 * 2 ** failures, MAX_BACKOFF_MS)
      await idle(wait)
    }
  }
}

/** Does one piece of work for `entry`. Returns how long to wait before the next one. */
async function step(entry: Entry): Promise<number> {
  const id = entry.base.id

  // 1. Not on the server yet: nobody else has it, so send the whole state at once.
  if (entry.version === 0) {
    if (entry.finish?.kind === 'end' && !entry.finish.match) {
      remove(id) // Discarded before it was ever shared.
      return 0
    }
    setStatus('syncing')
    let created: LiveSession
    try {
      created = await liveSessionsApi.create(view(entry))
    } catch (err) {
      if (!isRefused(err)) throw err
      // Can't ever be shared: end it here rather than retry forever.
      remove(id)
      emit({ type: 'ended', session: view(entry), savedMatchId: null, error: errorMessage(err) })
      return 0
    }
    // Taps made while the create was on its way are kept.
    const sent = entry.pending.length
    patch(id, (e) => ({ ...e, base: normalizeSession(created.state)!, version: created.version, pending: e.pending.slice(sent) }))
    if (created.endedAt) endedRemotely(created)
    return 0
  }

  // 2. Send the oldest queued tap.
  const [action] = entry.pending
  if (action) {
    const next = sessionReducer(entry.base, action)
    if (next === entry.base) {
      // Another phone already did it (or it changes nothing): drop it.
      patch(id, (e) => ({ ...e, pending: e.pending.slice(1) }))
      return 0
    }
    setStatus('syncing')
    try {
      const saved = await liveSessionsApi.update(id, entry.version, next)
      patch(id, (e) => ({ ...e, base: normalizeSession(saved.state)!, version: saved.version, pending: e.pending.slice(1) }))
    } catch (err) {
      if (isStatus(err, 409)) await refresh(id)
      else if (isStatus(err, 404)) patch(id, (e) => ({ ...e, version: 0 })) // Gone: share it again.
      else if (isRefused(err)) patch(id, (e) => ({ ...e, pending: e.pending.slice(1) })) // Drop the bad tap.
      else throw err
    }
    return 0
  }

  // 3. Ending or leaving, with every tap sent.
  if (entry.finish) {
    if (entry.finish.kind === 'leave') {
      remove(id)
      return 0
    }
    setStatus('syncing')
    let ended: LiveSession | null = null
    let error: string | undefined
    try {
      ended = await liveSessionsApi.end(id, entry.finish.match)
    } catch (err) {
      if (isRefused(err)) error = errorMessage(err)
      else if (!isStatus(err, 404)) throw err
    }
    remove(id)
    emit({ type: 'ended', session: view(entry), savedMatchId: ended?.savedMatchId ?? null, error })
    return 0
  }

  // 4. Nothing to send: look for changes from the other phones.
  await refresh(id)
  setStatus(find(id)?.pending.length ? 'syncing' : 'synced')
  return document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS
}

/** Takes the server's latest state for the session. */
async function refresh(id: string) {
  const entry = find(id)
  if (!entry) return
  let live: LiveSession | undefined
  try {
    live = await liveSessionsApi.get(id, entry.version)
  } catch (err) {
    if (!isStatus(err, 404)) throw err
    // Deleted on the server: treat it as ended.
    remove(id)
    if (!entry.finish) emit({ type: 'endedElsewhere', session: view(entry), byName: null, saved: false })
    return
  }
  if (!live) return // Unchanged.
  if (live.endedAt) {
    endedRemotely(live)
    return
  }
  patch(id, (e) => ({ ...e, base: normalizeSession(live.state)!, version: live.version }))
}

/** The session was ended on another phone: drop it here, queued taps included. */
function endedRemotely(live: LiveSession) {
  const entry = find(live.id)
  if (!entry) return
  remove(live.id)
  const session = normalizeSession(live.state) ?? view(entry)
  if (entry.finish?.kind === 'end') {
    // We were ending it too; the other phone was first.
    emit({ type: 'ended', session, savedMatchId: live.savedMatchId })
  } else if (!entry.finish) {
    emit({ type: 'endedElsewhere', session, byName: live.endedByName, saved: !!live.savedMatchId })
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') wake()
}

/** Runs the sync loop while at least one caller needs it. Returns the release function. */
export function retainSync() {
  running++
  if (running === 1) {
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', wake)
    void loop()
  }
  return () => {
    running--
    if (running === 0) {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', wake)
      wake()
    }
  }
}

// ---------- Public API ----------

/** Only one session is on screen: opening another one leaves the current one. */
const leaving = (e: Entry): Entry => (e.finish ? e : { ...e, finish: { kind: 'leave' } })

export const liveSession = {
  /** What `useLiveSession` returns, outside React. */
  snapshot: () => snapshot,

  /** Starts a new session on this phone and shares it. */
  start(session: Session) {
    entries = [...entries.map(leaving), { base: session, version: 0, pending: [] }]
    changed()
    wake()
  },

  /** Follows a session started on another phone. */
  join(live: LiveSession) {
    const base = normalizeSession(live.state)
    if (!base || live.endedAt) return
    if (find(live.id)) return
    entries = [...entries.map(leaving), { base, version: live.version, pending: [] }]
    changed()
    wake()
  },

  /** A tap on this phone. */
  dispatch(action: SessionAction) {
    const entry = currentEntry()
    if (!entry) return
    const shown = view(entry)
    const tap = withSeen(shown, action)
    if (sessionReducer(shown, tap) === shown) return
    patch(entry.base.id, (e) => ({ ...e, pending: [...e.pending, tap] }))
    wake()
  },

  /** Ends the session on every phone. `match` (with the session's id) is saved, `null` discards. */
  end(match: Match | null) {
    const entry = currentEntry()
    if (!entry) return
    patch(entry.base.id, (e) => ({ ...e, finish: { kind: 'end', match } }))
    wake()
  },

  /** Stops following the session on this phone. It keeps running on the others. */
  leave() {
    const entry = currentEntry()
    if (!entry) return
    patch(entry.base.id, (e) => ({ ...e, finish: { kind: 'leave' } }))
    wake()
  },

  /** Calls `listener` on every snapshot change. Returns the unsubscribe function. */
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  /** Calls `listener` when a session ends. Returns the unsubscribe function. */
  onEvent(listener: (e: LiveEvent) => void) {
    eventListeners.add(listener)
    return () => {
      eventListeners.delete(listener)
    }
  },
}

/** The session on this phone, kept in sync while mounted. */
export function useLiveSession(onEvent: (e: LiveEvent) => void): LiveSnapshot {
  useEffect(retainSync, [])
  useEffect(() => liveSession.onEvent(onEvent), [onEvent])
  return useSyncExternalStore(liveSession.subscribe, liveSession.snapshot)
}

/** Sessions running on other phones, refreshed every few seconds while `enabled`. */
export function useActiveSessions(enabled: boolean) {
  const subscribeActive = useCallback(
    (listener: () => void) => (enabled ? watchActive(listener) : () => {}),
    [enabled],
  )
  return useSyncExternalStore(subscribeActive, () => (enabled ? active : NONE))
}

const NONE: LiveSession[] = []
let active: LiveSession[] = NONE
const ACTIVE_POLL_MS = 10_000

function watchActive(listener: () => void) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const ctrl = new AbortController()
  async function tick() {
    clearTimeout(timer)
    if (document.visibilityState === 'visible') {
      try {
        const list = await liveSessionsApi.active(ctrl.signal)
        const mine = new Set(entries.map((e) => e.base.id))
        active = list.filter((s) => !mine.has(s.id))
        listener()
      } catch {
        // Offline: keep showing the last list.
      }
    }
    if (!stopped) timer = setTimeout(tick, ACTIVE_POLL_MS)
  }
  const onVisibleTick = () => document.visibilityState === 'visible' && void tick()
  document.addEventListener('visibilitychange', onVisibleTick)
  void tick()
  return () => {
    stopped = true
    clearTimeout(timer)
    ctrl.abort()
    document.removeEventListener('visibilitychange', onVisibleTick)
  }
}
