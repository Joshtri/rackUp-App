import type { SessionLog, Shot, Side } from './session'

export type SideStats = {
  racks: number
  shots: number
  /** Shots that kept the turn, plus the shot that won a rack. */
  made: number
  /** Most shots made in one turn. */
  bestRun: number
  /** Racks won in a single turn at the table. */
  runOuts: number
  /** Average shot clock time used per shot; null when no shot was timed. */
  avgShotMs: number | null
  extensions: number
  timeouts: number
  /** Most racks won in a row. */
  bestStreak: number
}

export type RackSummary = { number: number; winner: Side; ms: number }

export type SessionSummary = {
  durationMs: number
  sides: Record<Side, SideStats>
  racks: RackSummary[]
  avgRackMs: number | null
  fastest: RackSummary | null
  slowest: RackSummary | null
  /** False when no shot was tapped, so only rack data is meaningful. */
  hasShots: boolean
}

const blank = (): SideStats => ({
  racks: 0,
  shots: 0,
  made: 0,
  bestRun: 0,
  runOuts: 0,
  avgShotMs: null,
  extensions: 0,
  timeouts: 0,
  bestStreak: 0,
})

/** Split one rack's shots into turns: a turn ends on a miss, the rack end, or a side change. */
function turns(shots: Shot[]) {
  const out: Shot[][] = []
  let current: Shot[] = []
  for (const shot of shots) {
    if (current.length && current[0].side !== shot.side) {
      out.push(current)
      current = []
    }
    current.push(shot)
    if (shot.end !== 'continue') {
      out.push(current)
      current = []
    }
  }
  if (current.length) out.push(current)
  return out
}

export function summarize(log: SessionLog, startedAt: number, endedAt: number): SessionSummary {
  const sides: Record<Side, SideStats> = { A: blank(), B: blank() }
  const timed: Record<Side, number[]> = { A: [], B: [] }

  // Each rack's shots, plus the unfinished rack at the end (no winner yet).
  let from = 0
  const segments: { winner: Side | null; shots: Shot[] }[] = log.racks.map((r) => {
    const shots = log.shots.slice(from, r.shotEnd)
    from = r.shotEnd
    return { winner: r.winner, shots }
  })
  segments.push({ winner: null, shots: log.shots.slice(from) })

  for (const { winner, shots } of segments) {
    for (const shot of shots) {
      sides[shot.side].shots++
      if (shot.ms > 0) timed[shot.side].push(shot.ms)
    }
    const rackTurns = turns(shots)
    for (const turn of rackTurns) {
      const side = turn[0].side
      const last = turn.at(-1)!
      const made =
        turn.filter((s) => s.end === 'continue').length +
        (last.end === 'rack' && winner === side ? 1 : 0)
      sides[side].made += made
      sides[side].bestRun = Math.max(sides[side].bestRun, made)
    }
    if (winner) {
      const winnerTurns = rackTurns.filter((t) => t[0].side === winner)
      const lastTurn = rackTurns.at(-1)
      if (winnerTurns.length === 1 && lastTurn?.[0].side === winner && lastTurn.at(-1)!.end === 'rack') {
        sides[winner].runOuts++
      }
    }
  }

  for (const side of ['A', 'B'] as const) {
    const t = timed[side]
    sides[side].avgShotMs = t.length ? t.reduce((a, b) => a + b, 0) / t.length : null
    sides[side].extensions = log.extensions[side]
    sides[side].timeouts = log.timeouts[side]
  }

  const racks: RackSummary[] = log.racks.map((r, i) => ({
    number: i + 1,
    winner: r.winner,
    ms: Math.max(0, r.endedAt - r.startedAt),
  }))

  let streak = 0
  let prev: Side | null = null
  for (const r of racks) {
    sides[r.winner].racks++
    streak = r.winner === prev ? streak + 1 : 1
    prev = r.winner
    sides[r.winner].bestStreak = Math.max(sides[r.winner].bestStreak, streak)
  }

  const byTime = [...racks].sort((a, b) => a.ms - b.ms)
  return {
    durationMs: Math.max(0, endedAt - startedAt),
    sides,
    racks,
    avgRackMs: racks.length ? racks.reduce((sum, r) => sum + r.ms, 0) / racks.length : null,
    fastest: byTime[0] ?? null,
    slowest: racks.length > 1 ? byTime.at(-1)! : null,
    hasShots: log.shots.length > 0,
  }
}
