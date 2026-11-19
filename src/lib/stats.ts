import type { Match } from './matches'

export type Result = 'W' | 'L' | 'D'

export type PlayerStats = {
  name: string
  played: number
  won: number
  lost: number
  drawn: number
  racksFor: number
  racksAgainst: number
  winRate: number
  /** Latest results first, max 5. */
  form: Result[]
}

export type PairStats = {
  a: string
  b: string
  played: number
  winsA: number
  winsB: number
  draws: number
  racksA: number
  racksB: number
  lastDate: string
}

/** Expects matches sorted newest first. */
export function playerStats(matches: Match[]): PlayerStats[] {
  const map = new Map<string, PlayerStats>()
  const get = (name: string) => {
    let s = map.get(name)
    if (!s) {
      s = { name, played: 0, won: 0, lost: 0, drawn: 0, racksFor: 0, racksAgainst: 0, winRate: 0, form: [] }
      map.set(name, s)
    }
    return s
  }

  for (const m of matches) {
    const sides: [string, number, number][] = [
      [m.playerA, m.scoreA, m.scoreB],
      [m.playerB, m.scoreB, m.scoreA],
    ]
    for (const [name, mine, theirs] of sides) {
      const s = get(name)
      s.played++
      s.racksFor += mine
      s.racksAgainst += theirs
      const r: Result = mine > theirs ? 'W' : mine < theirs ? 'L' : 'D'
      if (r === 'W') s.won++
      else if (r === 'L') s.lost++
      else s.drawn++
      if (s.form.length < 5) s.form.push(r)
    }
  }

  for (const s of map.values()) s.winRate = s.played ? s.won / s.played : 0

  return [...map.values()].sort(
    (x, y) => y.won - x.won || y.winRate - x.winRate || y.racksFor - x.racksFor,
  )
}

/** Head-to-head per pair of players, most played first. Expects newest-first input. */
export function pairStats(matches: Match[]): PairStats[] {
  const map = new Map<string, PairStats>()

  for (const m of matches) {
    // Stable order so "A vs B" and "B vs A" land in the same bucket.
    const flip = m.playerA.localeCompare(m.playerB) > 0
    const [a, b] = flip ? [m.playerB, m.playerA] : [m.playerA, m.playerB]
    const [sa, sb] = flip ? [m.scoreB, m.scoreA] : [m.scoreA, m.scoreB]
    const key = `${a}\u0000${b}`

    let p = map.get(key)
    if (!p) {
      p = { a, b, played: 0, winsA: 0, winsB: 0, draws: 0, racksA: 0, racksB: 0, lastDate: m.date }
      map.set(key, p)
    }
    p.played++
    p.racksA += sa
    p.racksB += sb
    if (sa > sb) p.winsA++
    else if (sb > sa) p.winsB++
    else p.draws++
  }

  return [...map.values()].sort(
    (x, y) => y.played - x.played || y.lastDate.localeCompare(x.lastDate),
  )
}
