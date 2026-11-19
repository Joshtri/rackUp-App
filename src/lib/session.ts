/*
 * Live play session: shot clock, rack count and extensions.
 *
 * Rules:
 * - Every shot gets `shotSeconds` on the clock.
 * - Each player has one extension (`extSeconds`) per rack; it resets when a rack ends.
 * - When a rack ends, the winner's rack count goes up and the clock waits for the break.
 */

export type Side = 'A' | 'B'

export type SessionSettings = {
  shotSeconds: number
  extSeconds: number
  sound: boolean
}

export type Clock = {
  running: boolean
  /** Time left when the clock was last started or paused. */
  remainingMs: number
  /** Full time for this shot, including any extension (for the progress ring). */
  totalMs: number
  /** Timestamp when time runs out; only set while running. */
  endsAt: number | null
}

/**
 * One shot. It closes when the next button is tapped:
 * "Pukulan baru" → continue, "Ganti giliran" → turnover, rack won → rack.
 */
export type Shot = {
  side: Side
  /** Shot clock time used, in ms. 0 when the clock never ran. */
  ms: number
  end: 'continue' | 'turnover' | 'rack'
}

export type RackLog = {
  winner: Side
  startedAt: number
  endedAt: number
  /** shots.length right after this rack ended. */
  shotEnd: number
  /** How the rack's last shot was logged, so undo can take it back. */
  final: 'added' | 'marked' | null
}

/** Everything tapped during a session, used for the stats. */
export type SessionLog = {
  shots: Shot[]
  racks: RackLog[]
  extensions: Record<Side, number>
  timeouts: Record<Side, number>
}

export type Session = {
  /** Same id on every phone following this session (and on the server). */
  id: string
  playerA: string
  playerB: string
  /** Account linked to each side, so that player's phone knows it's their turn. */
  userA: string | null
  userB: string | null
  shotSeconds: number
  extSeconds: number
  racksA: number
  racksB: number
  /** Rack winners in order, used for undo. */
  rackWinners: Side[]
  turn: Side
  extUsed: Record<Side, boolean>
  startedAt: number
  clock: Clock
  /** When the clock first ran in the current rack (the break). */
  rackStartedAt: number | null
  log: SessionLog
}

/**
 * A tap. Several phones can control the same session, and a tap is re-applied
 * on top of whatever another phone did first. The `seen*` fields hold what the
 * tapping phone showed; when the session no longer matches, the tap is
 * dropped, so two phones tapping the same button at once count it once.
 */
export type SessionAction =
  | { type: 'toggle'; now: number; seenRunning?: boolean }
  | { type: 'nextShot'; now: number; seenShots?: number }
  | { type: 'switchTurn'; now: number; seenTurn?: Side }
  | { type: 'setTurn'; side: Side }
  | { type: 'extension'; now: number }
  | { type: 'expire' }
  | { type: 'rackWon'; side: Side; now: number; seenRacks?: number }
  | { type: 'undoRack'; seenRacks?: number }

export const other = (side: Side): Side => (side === 'A' ? 'B' : 'A')

const rackCount = (s: Session) => s.rackWinners.length

/** The action with the `seen*` fields filled in from what this phone shows now. */
export function withSeen(s: Session, action: SessionAction): SessionAction {
  switch (action.type) {
    case 'toggle':
      return { ...action, seenRunning: s.clock.running }
    case 'nextShot':
      return { ...action, seenShots: s.log.shots.length }
    case 'switchTurn':
      return { ...action, seenTurn: s.turn }
    case 'rackWon':
    case 'undoRack':
      return { ...action, seenRacks: rackCount(s) }
    default:
      return action
  }
}

/** False when the session moved on since the tap (another phone already did it). */
function stillValid(s: Session, a: SessionAction) {
  switch (a.type) {
    case 'toggle':
      return a.seenRunning === undefined || a.seenRunning === s.clock.running
    case 'nextShot':
      return a.seenShots === undefined || a.seenShots === s.log.shots.length
    case 'switchTurn':
      return a.seenTurn === undefined || a.seenTurn === s.turn
    case 'rackWon':
    case 'undoRack':
      return a.seenRacks === undefined || a.seenRacks === rackCount(s)
    default:
      return true
  }
}

function freshClock(seconds: number, running: boolean, now: number): Clock {
  const ms = seconds * 1000
  return { running, remainingMs: ms, totalMs: ms, endsAt: running ? now + ms : null }
}

export function createSession(
  playerA: string,
  playerB: string,
  settings: Pick<SessionSettings, 'shotSeconds' | 'extSeconds'>,
  { now, userA = null, userB = null }: { now: number; userA?: string | null; userB?: string | null },
): Session {
  return {
    id: crypto.randomUUID(),
    playerA,
    playerB,
    userA,
    userB,
    shotSeconds: settings.shotSeconds,
    extSeconds: settings.extSeconds,
    racksA: 0,
    racksB: 0,
    rackWinners: [],
    turn: 'A',
    extUsed: { A: false, B: false },
    startedAt: now,
    clock: freshClock(settings.shotSeconds, false, 0),
    rackStartedAt: null,
    log: emptyLog(),
  }
}

/** Which side the account plays, if any. */
export function sideOf(s: Session, userId: string | undefined | null): Side | null {
  if (!userId) return null
  if (s.userA === userId) return 'A'
  if (s.userB === userId) return 'B'
  return null
}

export const emptyLog = (): SessionLog => ({
  shots: [],
  racks: [],
  extensions: { A: 0, B: 0 },
  timeouts: { A: 0, B: 0 },
})

/** Clock time used on the current shot. */
function usedMs(clock: Clock, now: number) {
  return Math.max(0, clock.totalMs - remainingAt(clock, now))
}

function addShot(s: Session, now: number, end: Shot['end']): SessionLog {
  const shot: Shot = { side: s.turn, ms: usedMs(s.clock, now), end }
  return { ...s.log, shots: [...s.log.shots, shot] }
}

/** The clock starting for the first time in a rack marks the break. */
const rackStart = (s: Session, now: number) => s.rackStartedAt ?? now

/** Time left on the clock at `now`. */
export function remainingAt(clock: Clock, now: number) {
  if (!clock.running || clock.endsAt === null) return clock.remainingMs
  return Math.min(clock.remainingMs, Math.max(0, clock.endsAt - now))
}

/**
 * Applies a tap. Returns the same object when the tap changes nothing,
 * so callers can skip sending it.
 */
export function sessionReducer(s: Session, action: SessionAction): Session {
  if (!stillValid(s, action)) return s
  switch (action.type) {
    case 'toggle': {
      const { clock } = s
      if (clock.running) {
        const left = remainingAt(clock, action.now)
        return { ...s, clock: { ...clock, running: false, remainingMs: left, endsAt: null } }
      }
      const rackStartedAt = rackStart(s, action.now)
      // Time ran out: starting again means a new shot.
      if (clock.remainingMs <= 0)
        return { ...s, rackStartedAt, clock: freshClock(s.shotSeconds, true, action.now) }
      return {
        ...s,
        rackStartedAt,
        clock: { ...clock, running: true, endsAt: action.now + clock.remainingMs },
      }
    }
    case 'nextShot':
      return {
        ...s,
        log: addShot(s, action.now, 'continue'),
        rackStartedAt: rackStart(s, action.now),
        clock: freshClock(s.shotSeconds, true, action.now),
      }
    case 'switchTurn':
      return {
        ...s,
        log: addShot(s, action.now, 'turnover'),
        rackStartedAt: rackStart(s, action.now),
        turn: other(s.turn),
        clock: freshClock(s.shotSeconds, true, action.now),
      }
    case 'setTurn':
      if (s.turn === action.side) return s
      return { ...s, turn: action.side, clock: freshClock(s.shotSeconds, false, 0) }
    case 'extension': {
      if (s.extUsed[s.turn]) return s
      const add = s.extSeconds * 1000
      const { clock } = s
      const left = remainingAt(clock, action.now)
      return {
        ...s,
        extUsed: { ...s.extUsed, [s.turn]: true },
        log: {
          ...s.log,
          extensions: { ...s.log.extensions, [s.turn]: s.log.extensions[s.turn] + 1 },
        },
        clock: {
          ...clock,
          remainingMs: left + add,
          totalMs: Math.max(clock.totalMs, left) + add,
          endsAt: clock.running ? action.now + left + add : null,
        },
      }
    }
    case 'expire':
      // The tick can fire more than once at zero; count the timeout only once.
      if (!s.clock.running) return s
      return {
        ...s,
        log: {
          ...s.log,
          timeouts: { ...s.log.timeouts, [s.turn]: s.log.timeouts[s.turn] + 1 },
        },
        clock: { ...s.clock, running: false, remainingMs: 0, endsAt: null },
      }
    case 'rackWon': {
      const { now, side } = action
      let log = s.log
      let final: RackLog['final'] = null
      const prevEnd = log.racks.at(-1)?.shotEnd ?? 0
      const lastShot = log.shots.length > prevEnd ? log.shots.at(-1) : undefined
      if (usedMs(s.clock, now) >= 1000) {
        // The winning (or losing) shot was still on the clock.
        log = addShot(s, now, 'rack')
        final = 'added'
      } else if (lastShot?.end === 'continue') {
        // "Pukulan baru" was tapped right before: that shot ended the rack.
        log = { ...log, shots: [...log.shots.slice(0, -1), { ...lastShot, end: 'rack' }] }
        final = 'marked'
      }
      const rack: RackLog = {
        winner: side,
        startedAt: s.rackStartedAt ?? s.log.racks.at(-1)?.endedAt ?? s.startedAt,
        endedAt: now,
        shotEnd: log.shots.length,
        final,
      }
      return {
        ...s,
        racksA: s.racksA + (side === 'A' ? 1 : 0),
        racksB: s.racksB + (side === 'B' ? 1 : 0),
        rackWinners: [...s.rackWinners, side],
        extUsed: { A: false, B: false },
        clock: freshClock(s.shotSeconds, false, 0),
        rackStartedAt: null,
        log: { ...log, racks: [...log.racks, rack] },
      }
    }
    case 'undoRack': {
      const last = s.rackWinners.at(-1)
      if (!last) return s
      const rack = s.log.racks.at(-1)
      let log = s.log
      if (rack) {
        // Keep the last shot as a normal one: picking the winner again marks it as the rack end.
        const shots = [...log.shots]
        const i = rack.shotEnd - 1
        if (rack.final) shots[i] = { ...shots[i], end: 'continue' }
        log = { ...log, shots, racks: log.racks.slice(0, -1) }
      }
      return {
        ...s,
        racksA: s.racksA - (last === 'A' ? 1 : 0),
        racksB: s.racksB - (last === 'B' ? 1 : 0),
        rackWinners: s.rackWinners.slice(0, -1),
        clock: freshClock(s.shotSeconds, false, 0),
        rackStartedAt: rack?.startedAt ?? s.rackStartedAt,
        log,
      }
    }
  }
}

/* ---------- Storage ---------- */

const SESSION_KEY = 'pocket-ball-trackers:session:v1'
const SETTINGS_KEY = 'pocket-ball-trackers:session-settings:v1'

export const DEFAULT_SETTINGS: SessionSettings = { shotSeconds: 30, extSeconds: 30, sound: true }

export function loadSettings(): SessionSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: SessionSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

/**
 * Fills in fields that older saved sessions don't have.
 * Returns null when `value` isn't a session at all.
 */
export function normalizeSession(value: unknown): Session | null {
  const s = value as Partial<Session> | null
  if (typeof s?.playerA !== 'string' || typeof s?.playerB !== 'string') return null
  if (!s.clock || typeof s.clock !== 'object') return null
  return {
    ...(s as Session),
    id: typeof s.id === 'string' ? s.id : crypto.randomUUID(),
    userA: s.userA ?? null,
    userB: s.userB ?? null,
    // Sessions saved before stats existed have no log.
    rackStartedAt: s.rackStartedAt ?? null,
    log: s.log ?? emptyLog(),
  }
}

/**
 * A session from the version that kept it only on this phone. It is taken
 * once (and removed) so it can carry on as a shared session. It comes back
 * paused, as it always did after a reload.
 */
export function takeLegacySession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    localStorage.removeItem(SESSION_KEY)
    const s = normalizeSession(JSON.parse(raw))
    if (!s) return null
    const left = remainingAt(s.clock, Date.now())
    return { ...s, clock: { ...s.clock, running: false, remainingMs: left, endsAt: null } }
  } catch {
    return null
  }
}
