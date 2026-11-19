import { useMemo } from 'react'
import { formatPercent, formatShortDate } from '../lib/format'
import type { Match } from '../lib/matches'
import { pairStats, playerStats, type Result } from '../lib/stats'
import { PlayerBall } from './PlayerBall'

const RESULT_LABEL: Record<Result, string> = { W: 'Menang', L: 'Kalah', D: 'Seri' }

export function StatsView({ matches }: { matches: Match[] }) {
  const players = useMemo(() => playerStats(matches), [matches])
  const pairs = useMemo(() => pairStats(matches), [matches])

  return (
    <div className="stats">
      <section>
        <h3 className="section-title">Klasemen pemain</h3>
        <div className="table-wrap">
          <table className="standings">
            <thead>
              <tr>
                <th scope="col" className="standings__name">Pemain</th>
                <th scope="col" title="Jumlah sesi main">Main</th>
                <th scope="col" title="Menang">M</th>
                <th scope="col" title="Kalah">K</th>
                <th scope="col" title="Rack menang – rack kalah">Rack</th>
                <th scope="col" title="Persentase menang">Win</th>
                <th scope="col" className="standings__form">5 terakhir</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.name}>
                  <th scope="row" className="standings__name">
                    <span className="standings__rank">{i + 1}</span>
                    <PlayerBall name={p.name} size="sm" />
                    <span className="standings__player">{p.name}</span>
                  </th>
                  <td>{p.played}</td>
                  <td className="strong">{p.won}</td>
                  <td>{p.lost}</td>
                  <td className="nowrap">
                    {p.racksFor}–{p.racksAgainst}
                  </td>
                  <td>{formatPercent(p.winRate)}</td>
                  <td className="standings__form">
                    <span className="form-dots">
                      {p.form.map((r, j) => (
                        <span key={j} className="form-dot" data-result={r} title={RESULT_LABEL[r]}>
                          {r === 'W' ? 'M' : r === 'L' ? 'K' : 'S'}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="section-title">Head to head</h3>
        <ul className="h2h-list">
          {pairs.map((p) => {
            const total = p.racksA + p.racksB || 1
            return (
              <li key={`${p.a}|${p.b}`} className="h2h-card">
                <div className="h2h-card__score">
                  <span className="h2h-card__player">
                    <PlayerBall name={p.a} size="sm" />
                    <span>{p.a}</span>
                  </span>
                  <span className="h2h-card__nums">
                    <b data-lead={p.winsA > p.winsB ? '' : undefined}>{p.winsA}</b>
                    <i>–</i>
                    <b data-lead={p.winsB > p.winsA ? '' : undefined}>{p.winsB}</b>
                  </span>
                  <span className="h2h-card__player" data-end="">
                    <span>{p.b}</span>
                    <PlayerBall name={p.b} size="sm" />
                  </span>
                </div>
                <div
                  className="rack-bar"
                  role="img"
                  aria-label={`Total rack ${p.a} ${p.racksA}, ${p.b} ${p.racksB}`}
                >
                  <span style={{ flexGrow: p.racksA / total }} />
                  <span style={{ flexGrow: p.racksB / total }} />
                </div>
                <p className="h2h-card__meta">
                  {p.played}× main · rack {p.racksA}–{p.racksB}
                  {p.draws > 0 && ` · ${p.draws} seri`} · terakhir {formatShortDate(p.lastDate)}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
