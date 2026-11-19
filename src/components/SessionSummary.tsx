import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useId, type ReactNode } from 'react'
import { formatDuration, formatMinutes, formatPercent } from '../lib/format'
import type { Side } from '../lib/session'
import type { SessionSummary, SideStats } from '../lib/sessionStats'
import { PlayerBall } from './PlayerBall'

type Players = { playerA: string; playerB: string }

type Row = {
  label: string
  value: (s: SideStats) => number | null
  show?: (s: SideStats) => string
  /** Which way is better, for highlighting the leader. */
  better?: 'high' | 'low'
  /** Only meaningful when shots were tapped. */
  shotsOnly?: boolean
}

const seconds = (ms: number | null) => (ms === null ? '–' : `${Math.round(ms / 1000)} dtk`)
const madeRate = (s: SideStats) => (s.shots ? s.made / s.shots : null)

const ROWS: Row[] = [
  { label: 'Pukulan', value: (s) => s.shots, shotsOnly: true },
  {
    label: 'Pukulan sukses',
    value: madeRate,
    show: (s) => (s.shots ? formatPercent(s.made / s.shots) : '–'),
    better: 'high',
    shotsOnly: true,
  },
  { label: 'Run terbaik', value: (s) => s.bestRun, better: 'high', shotsOnly: true },
  { label: 'Run-out', value: (s) => s.runOuts, better: 'high', shotsOnly: true },
  {
    label: 'Rata-rata waktu pukulan',
    value: (s) => s.avgShotMs,
    show: (s) => seconds(s.avgShotMs),
    shotsOnly: true,
  },
  { label: 'Rack beruntun', value: (s) => s.bestStreak, better: 'high' },
  { label: 'Extension dipakai', value: (s) => s.extensions },
  { label: 'Waktu habis', value: (s) => s.timeouts, better: 'low' },
]

function leader(row: Row, a: number | null, b: number | null): Side | null {
  if (!row.better || a === null || b === null || a === b) return null
  const aBetter = row.better === 'high' ? a > b : a < b
  return aBetter ? 'A' : 'B'
}

export function SessionSummaryView({
  summary,
  playerA,
  playerB,
}: { summary: SessionSummary } & Players) {
  const { sides, racks } = summary
  const name = (side: Side) => (side === 'A' ? playerA : playerB)
  const rows = ROWS.filter((r) => summary.hasShots || !r.shotsOnly)

  return (
    <div className="summary">
      <div className="summary__score">
        <span className="summary__player" data-side="A">
          <PlayerBall name={playerA} />
          <span>{playerA}</span>
        </span>
        <span className="summary__nums" aria-label={`Skor ${sides.A.racks} lawan ${sides.B.racks}`}>
          <b data-lead={sides.A.racks > sides.B.racks ? '' : undefined}>{sides.A.racks}</b>
          <i>–</i>
          <b data-lead={sides.B.racks > sides.A.racks ? '' : undefined}>{sides.B.racks}</b>
        </span>
        <span className="summary__player" data-side="B">
          <PlayerBall name={playerB} />
          <span>{playerB}</span>
        </span>
      </div>

      <dl className="summary__facts">
        <div>
          <dt>Durasi</dt>
          <dd>{formatMinutes(summary.durationMs)}</dd>
        </div>
        <div>
          <dt>Rack</dt>
          <dd>{racks.length}</dd>
        </div>
        <div>
          <dt>Rata-rata rack</dt>
          <dd>{summary.avgRackMs === null ? '–' : formatDuration(summary.avgRackMs)}</dd>
        </div>
      </dl>

      <section>
        <h3 className="section-title">Perbandingan</h3>
        <ul className="compare">
          {rows.map((row) => {
            const a = row.value(sides.A)
            const b = row.value(sides.B)
            const lead = leader(row, a, b)
            const total = (a ?? 0) + (b ?? 0)
            const fmt = (s: SideStats) => row.show?.(s) ?? String(row.value(s) ?? '–')
            return (
              <li key={row.label} className="compare__row">
                <span className="compare__val" data-side="A" data-lead={lead === 'A' ? '' : undefined}>
                  {fmt(sides.A)}
                </span>
                <span className="compare__label">{row.label}</span>
                <span className="compare__val" data-side="B" data-lead={lead === 'B' ? '' : undefined}>
                  {fmt(sides.B)}
                </span>
                <span className="compare__bar" data-empty={total ? undefined : ''} aria-hidden="true">
                  <span style={{ flexGrow: total ? (a ?? 0) / total : 1 }} />
                  <span style={{ flexGrow: total ? (b ?? 0) / total : 1 }} />
                </span>
              </li>
            )
          })}
        </ul>
        {!summary.hasShots && (
          <p className="summary__note">
            Statistik pukulan muncul kalau tombol <b>Pukulan baru</b> dan <b>Ganti giliran</b>{' '}
            dipakai selama main.
          </p>
        )}
      </section>

      {racks.length > 0 && (
        <section>
          <h3 className="section-title">Alur rack</h3>
          <ol className="rack-flow">
            {racks.map((r) => (
              <li
                key={r.number}
                className="rack-flow__item"
                data-side={r.winner}
                aria-label={`Rack ${r.number}: ${name(r.winner)}, ${formatDuration(r.ms)}`}
              >
                <span className="rack-flow__chip">{[...name(r.winner)][0]?.toUpperCase()}</span>
                <span className="rack-flow__num">{r.number}</span>
              </li>
            ))}
          </ol>
          {summary.fastest && (
            <p className="summary__note">
              Tercepat: rack {summary.fastest.number} ({formatDuration(summary.fastest.ms)})
              {summary.slowest &&
                ` · Terlama: rack ${summary.slowest.number} (${formatDuration(summary.slowest.ms)})`}
            </p>
          )}
        </section>
      )}

      <p className="summary__foot">
        Dihitung dari tombol yang ditekan selama sesi. Pukulan sukses = pukulan yang lanjut ke
        "Pukulan baru" atau memenangkan rack.
      </p>
    </div>
  )
}

/** Full screen on phones, with the buttons pinned at the bottom. */
export function SummaryDialog({
  open,
  onClose,
  title,
  subtitle,
  summary,
  playerA,
  playerB,
  actions,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  summary: SessionSummary | null
  actions: ReactNode
} & Players) {
  const phone = useMediaQuery('(max-width: 559.95px)')
  const titleId = useId()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      scroll="paper"
      aria-labelledby={titleId}
      slotProps={{ paper: { className: 'summary-dialog' } }}
    >
      <DialogTitle id={titleId} className="summary-dialog__title">
        {title}
        {subtitle && <small>{subtitle}</small>}
      </DialogTitle>
      <DialogContent dividers className="summary-dialog__content">
        {summary && <SessionSummaryView summary={summary} playerA={playerA} playerB={playerB} />}
      </DialogContent>
      <DialogActions disableSpacing className="summary-dialog__actions">
        {actions}
      </DialogActions>
    </Dialog>
  )
}
