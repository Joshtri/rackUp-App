import Button from '@mui/material/Button'
import type { LiveSession } from '../lib/api/liveSessions'
import { normalizeSession, sideOf } from '../lib/session'
import { TimerIcon } from './icons'
import { PlayerBall } from './PlayerBall'

/** Sessions running on other phones, each with a button to follow it here. */
export function LiveSessionsBanner({
  sessions,
  meId,
  onJoin,
}: {
  sessions: LiveSession[]
  meId: string | undefined
  onJoin: (s: LiveSession) => void
}) {
  if (sessions.length === 0) return null
  return (
    <section className="live-banner" aria-label="Sesi yang sedang berjalan">
      {sessions.map((live) => {
        const s = normalizeSession(live.state)
        if (!s) return null
        const playing = sideOf(s, meId) !== null
        return (
          <article key={live.id} className="live-banner__item" data-mine={playing ? '' : undefined}>
            <div className="live-banner__info">
              <p className="live-banner__eyebrow">
                <span className="live-banner__dot" aria-hidden="true" />
                {playing ? 'Kamu main di sesi ini' : 'Sesi sedang berjalan'} · Rack{' '}
                {s.racksA + s.racksB + 1}
              </p>
              <p className="live-banner__score">
                <PlayerBall name={s.playerA} size="sm" />
                <span className="live-banner__name">{s.playerA}</span>
                <b>
                  {s.racksA} – {s.racksB}
                </b>
                <span className="live-banner__name">{s.playerB}</span>
                <PlayerBall name={s.playerB} size="sm" />
              </p>
            </div>
            <Button
              variant={playing ? 'contained' : 'outlined'}
              startIcon={<TimerIcon />}
              onClick={() => onJoin(live)}
            >
              Gabung
            </Button>
          </article>
        )
      })}
    </section>
  )
}
