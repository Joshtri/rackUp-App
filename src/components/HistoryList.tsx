import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { useMemo } from 'react'
import { dayOfMonth, formatFullDate, formatMonth, formatWeekday } from '../lib/format'
import type { Match } from '../lib/matches'
import { ChartIcon, EditIcon, TrashIcon } from './icons'
import { MoreMenu } from './MoreMenu'
import { PlayerBall } from './PlayerBall'

type Props = {
  matches: Match[]
  onEdit: (match: Match) => void
  onDelete: (match: Match) => void
  onStats: (match: Match) => void
}

export function HistoryList({ matches, onEdit, onDelete, onStats }: Props) {
  const groups = useMemo(() => {
    const out: { month: string; items: Match[] }[] = []
    for (const m of matches) {
      const month = formatMonth(m.date)
      const last = out.at(-1)
      if (last?.month === month) last.items.push(m)
      else out.push({ month, items: [m] })
    }
    return out
  }, [matches])

  return (
    <div className="history">
      {groups.map((g) => (
        <section key={g.month} className="history__group">
          <h3 className="history__month">
            {g.month}
            <span>{g.items.length} sesi</span>
          </h3>
          <ol className="history__list">
            {g.items.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                onEdit={onEdit}
                onDelete={onDelete}
                onStats={onStats}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function MatchCard({
  match: m,
  onEdit,
  onDelete,
  onStats,
}: { match: Match } & Omit<Props, 'matches'>) {
  const winner = m.scoreA > m.scoreB ? 'A' : m.scoreB > m.scoreA ? 'B' : null

  return (
    <li className="match-card">
      <time className="match-card__date" dateTime={m.date} title={formatFullDate(m.date)}>
        <span className="match-card__day">{dayOfMonth(m.date)}</span>
        <span className="match-card__weekday">{formatWeekday(m.date)}</span>
      </time>

      <div className="match-card__body">
        <Side name={m.playerA} score={m.scoreA} won={winner === 'A'} />
        <Side name={m.playerB} score={m.scoreB} won={winner === 'B'} />
        {winner === null && (
          <Chip label="Seri" size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
        )}
        {m.note && <p className="match-card__note">{m.note}</p>}
        {m.log && (
          <Button
            className="match-card__stats"
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<ChartIcon />}
            onClick={() => onStats(m)}
          >
            Lihat statistik
          </Button>
        )}
      </div>

      {/* A friend's match you didn't play in is read-only. */}
      {m.canEdit !== false && (
        <MoreMenu
          className="match-card__menu"
          label="Pilihan"
          items={[
            { label: 'Edit', icon: <EditIcon />, onClick: () => onEdit(m) },
            { label: 'Hapus', icon: <TrashIcon />, onClick: () => onDelete(m), danger: true },
          ]}
        />
      )}
    </li>
  )
}

function Side({ name, score, won }: { name: string; score: number; won: boolean }) {
  return (
    <div className="side" data-won={won ? '' : undefined}>
      <PlayerBall name={name} size="sm" />
      <span className="side__name">{name}</span>
      {won && <span className="side__crown">Menang</span>}
      <span className="side__score">{score}</span>
    </div>
  )
}
