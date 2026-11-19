import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, errorMessage } from './api/client'
import { IMPORT_BATCH, matchesApi } from './api/matches'
import type { SessionLog, Side } from './session'
import { useToast } from './toast'

/** Tap log of a live session, kept for the stats. */
export type MatchLog = SessionLog & { startedAt: number; endedAt: number }

export type Match = {
  id: string
  /** Local date, format YYYY-MM-DD */
  date: string
  playerA: string
  playerB: string
  scoreA: number
  scoreB: number
  note?: string
  /** Only for matches played with the shot clock. */
  log?: MatchLog
  createdAt: number
  /**
   * From the API: whether you may edit/delete it (you recorded or played in
   * it). Missing on a match you just added, which is yours.
   */
  canEdit?: boolean
}

export type MatchInput = Omit<Match, 'id' | 'createdAt' | 'canEdit'>

const isSideCount = (v: unknown) =>
  !!v && typeof v === 'object' && Number.isFinite((v as Record<string, unknown>).A) &&
  Number.isFinite((v as Record<string, unknown>).B)

function isLog(value: unknown): value is MatchLog {
  if (!value || typeof value !== 'object') return false
  const l = value as Record<string, unknown>
  return (
    Array.isArray(l.shots) &&
    Array.isArray(l.racks) &&
    isSideCount(l.extensions) &&
    isSideCount(l.timeouts) &&
    Number.isFinite(l.startedAt) &&
    Number.isFinite(l.endedAt)
  )
}

function isMatch(value: unknown): value is Match {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    typeof m.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(m.date) &&
    typeof m.playerA === 'string' &&
    typeof m.playerB === 'string' &&
    Number.isFinite(m.scoreA) &&
    Number.isFinite(m.scoreB) &&
    (m.note === undefined || typeof m.note === 'string') &&
    (m.log === undefined || isLog(m.log)) &&
    Number.isFinite(m.createdAt)
  )
}

// ---- Data saved on this device before the app used the API ----

const LEGACY_KEY = 'pocket-ball-trackers:matches:v1'

/** Matches still in this browser's localStorage from the offline-only version. */
export function loadLocalMatches(): Match[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isMatch) : []
  } catch {
    return []
  }
}

export function clearLocalMatches() {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Storage blocked: nothing to clear.
  }
}

// ---- Rules shared with the backend ----

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ')
const sameName = (x: string, y: string) => x.toLowerCase() === y.toLowerCase()

function flipLog(log: MatchLog): MatchLog {
  const flip = (side: Side): Side => (side === 'A' ? 'B' : 'A')
  return {
    ...log,
    shots: log.shots.map((s) => ({ ...s, side: flip(s.side) })),
    racks: log.racks.map((r) => ({ ...r, winner: flip(r.winner) })),
    extensions: { A: log.extensions.B, B: log.extensions.A },
    timeouts: { A: log.timeouts.B, B: log.timeouts.A },
  }
}

/**
 * Applies an edit locally, the same way the server does: a name typed with
 * different capitalisation ("budi" → "Budi") is a fix and is renamed across
 * all records, and swapping sides also swaps the shot-clock log.
 */
function applyUpdate(prev: Match[], id: string, input: MatchInput): Match[] {
  const a = cleanName(input.playerA)
  const b = cleanName(input.playerB)
  const renames = new Map<string, string>()
  for (const name of [a, b]) {
    for (const m of prev) {
      for (const p of [m.playerA, m.playerB]) {
        if (p !== name && p.toLowerCase() === name.toLowerCase()) renames.set(p, name)
      }
    }
  }
  return prev.map((m) => {
    let next = m.id === id ? { ...m, ...input, log: m.log, playerA: a, playerB: b } : m
    if (m.id === id && m.log && sameName(a, m.playerB) && sameName(b, m.playerA)) {
      next = { ...next, log: flipLog(m.log) }
    }
    return {
      ...next,
      playerA: renames.get(next.playerA) ?? next.playerA,
      playerB: renames.get(next.playerB) ?? next.playerB,
    }
  })
}

/** Newest date first; same date → newest entry first. */
export function sortMatches(matches: Match[]) {
  return [...matches].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  )
}

/** Parse an exported backup file. Throws with a readable message on bad input. */
export function parseBackup(text: string): Match[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('File bukan JSON yang valid.')
  }
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { matches?: unknown })?.matches
  if (!Array.isArray(list)) throw new Error('Format file tidak dikenali.')
  const valid = list.filter(isMatch)
  if (valid.length === 0) throw new Error('Tidak ada data main di file ini.')
  return valid
}

export type MatchesStatus = 'loading' | 'ready' | 'error'

const SHARED_REFRESH_MS = 30_000

/**
 * The match history, stored on the API and shared by all accounts.
 * Changes show up immediately (optimistic) and are rolled back with an error
 * toast + "Coba lagi" if the server refuses them.
 */
export function useMatches() {
  const toast = useToast()
  const [matches, setMatches] = useState<Match[]>([])
  const [status, setStatus] = useState<MatchesStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  // Created locally but not confirmed yet; kept when the list is re-fetched.
  const pending = useRef(new Set<string>())

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const list = await matchesApi.list(signal)
      const ids = new Set(list.map((m) => m.id))
      setMatches((prev) => [
        ...list,
        ...prev.filter((m) => pending.current.has(m.id) && !ids.has(m.id)),
      ])
      setStatus('ready')
      setLoadError(null)
    } catch (err) {
      if (signal?.aborted) return
      setLoadError(errorMessage(err))
      setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    void refresh(ctrl.signal)
    return () => ctrl.abort()
  }, [refresh])

  // The history is shared with the other accounts: pick up their changes
  // when the app comes back to the front, and now and then while it's open.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    const timer = setInterval(onVisible, SHARED_REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const reload = useCallback(() => {
    setStatus('loading')
    void refresh()
  }, [refresh])

  /** Error toast. A 401 is skipped: the app is already going to the login page. */
  function fail(title: string, err: unknown, retry: () => void) {
    if (err instanceof ApiError && err.status === 401) return
    const id = toast.add({
      title,
      description: errorMessage(err),
      type: 'error',
      timeout: 10_000,
      action: {
        label: 'Coba lagi',
        onClick: () => {
          toast.close(id)
          retry()
        },
      },
    })
  }

  /** POST a match. Safe to repeat: the server returns the existing one for a known id. */
  function send(match: Match) {
    pending.current.add(match.id)
    setMatches((prev) => (prev.some((m) => m.id === match.id) ? prev : [...prev, match]))
    matchesApi
      .create(match)
      .then((saved) => setMatches((prev) => prev.map((m) => (m.id === saved.id ? saved : m))))
      .catch((err: unknown) => {
        setMatches((prev) => prev.filter((m) => m.id !== match.id))
        fail('Gagal menyimpan', err, () => send(match))
      })
      .finally(() => pending.current.delete(match.id))
  }

  const sorted = useMemo(() => sortMatches(matches), [matches])

  const players = useMemo(() => {
    // Most recently used names first.
    const seen = new Set<string>()
    for (const m of sorted) {
      seen.add(m.playerA)
      seen.add(m.playerB)
    }
    return [...seen]
  }, [sorted])

  /** Reuse the existing spelling of a name, ignoring case and extra spaces. */
  function canonicalName(name: string) {
    const clean = cleanName(name)
    return players.find((p) => p.toLowerCase() === clean.toLowerCase()) ?? clean
  }

  /** A match ready to save, with the existing spelling of the player names. */
  function build(input: MatchInput, id: string = crypto.randomUUID()): Match {
    return {
      ...input,
      playerA: canonicalName(input.playerA),
      playerB: canonicalName(input.playerB),
      id,
      createdAt: Date.now(),
    }
  }

  function add(input: MatchInput) {
    const match = build(input)
    send(match)
    return match
  }

  /**
   * Shows a match that is being saved some other way (a shared session saves
   * its result when it ends). It stays until a refresh finds it on the server,
   * or `settle(id, false)` drops it.
   */
  function showPending(match: Match) {
    pending.current.add(match.id)
    setMatches((prev) => (prev.some((m) => m.id === match.id) ? prev : [...prev, match]))
  }

  /** The other half of `showPending`: `saved=false` removes it again. */
  function settle(id: string, saved: boolean) {
    pending.current.delete(id)
    if (!saved) setMatches((prev) => prev.filter((m) => m.id !== id))
    void refresh()
  }

  function update(id: string, input: MatchInput) {
    setMatches((prev) => applyUpdate(prev, id, input))
    matchesApi
      .update(id, input)
      // Renames can touch other records, so take the server's full list.
      .then(() => refresh())
      .catch((err: unknown) => {
        void refresh()
        fail('Gagal memperbarui', err, () => update(id, input))
      })
  }

  function remove(id: string) {
    setMatches((prev) => prev.filter((m) => m.id !== id))
    matchesApi.remove(id).catch((err: unknown) => {
      // Already gone on the server is fine.
      if (err instanceof ApiError && err.code === 'not_found') return
      void refresh()
      fail('Gagal menghapus', err, () => remove(id))
    })
  }

  /** Undo a delete: re-create with the same id and createdAt. */
  const restore = send

  /** Merge by id on the server; returns how many new records were added. Throws on failure. */
  async function importMatches(incoming: Match[]) {
    let added = 0
    try {
      for (let i = 0; i < incoming.length; i += IMPORT_BATCH) {
        added += (await matchesApi.import(incoming.slice(i, i + IMPORT_BATCH))).added
      }
    } finally {
      // Also after a partial failure, so the list shows what did get in.
      await refresh()
    }
    return added
  }

  return {
    matches: sorted,
    players,
    status,
    loadError,
    reload,
    refresh,
    build,
    add,
    showPending,
    settle,
    update,
    remove,
    restore,
    importMatches,
  }
}
