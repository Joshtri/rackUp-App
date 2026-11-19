import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/format'
import type { SyncStatus } from '../lib/liveSession'
import { serverNow } from '../lib/serverClock'
import { remainingAt, sideOf, type Session, type SessionAction, type Side } from '../lib/session'
import { summarize } from '../lib/sessionStats'
import { beep, playTimeUp, unlockAudio, vibrate, wntBeep } from '../lib/sound'
import { useToast } from '../lib/toast'
import { useWakeLock } from '../lib/useWakeLock'
import {
  CloseIcon,
  FlagIcon,
  MuteIcon,
  PlusIcon,
  ResetIcon,
  SoundIcon,
  SwapIcon,
} from './icons'
import { PlayerBall } from './PlayerBall'
import { SummaryDialog } from './SessionSummary'

type Props = {
  session: Session
  dispatch: (action: SessionAction) => void
  sound: boolean
  onToggleSound: () => void
  /** save=true stores the result in the history. Ends it on every phone. */
  onEnd: (save: boolean) => void
  /** Close the session on this phone only; it keeps running on the others. */
  onLeave: () => void
  /** The logged-in account, to tell when it's this player's turn. */
  meId: string | undefined
  sync: SyncStatus
  /** Not shared yet (offline since it started), so leaving would lose it. */
  localOnly: boolean
}

const SIDES: Side[] = ['A', 'B']
const RING = 2 * Math.PI * 46
// Server time, so every phone on the session counts down from the same moment.
const timestamp = () => serverNow()
/** This phone's own clock, for "did I just tap?" checks. */
const wallClock = () => Date.now()

const SYNC_LABEL: Record<SyncStatus, string> = {
  synced: 'Tersambung',
  syncing: 'Menyinkronkan…',
  offline: 'Offline, disimpan di HP ini',
}

export function SessionScreen({
  session: s,
  dispatch,
  sound,
  onToggleSound,
  onEnd,
  onLeave,
  meId,
  sync,
  localOnly,
}: Props) {
  const toast = useToast()
  const [now, setNow] = useState(serverNow)
  const [rackOpen, setRackOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const lastSecond = useRef<number | null>(null)
  const { clock } = s

  useWakeLock(true)

  // Shot clock tick: redraw, beep near the end, stop at zero.
  useEffect(() => {
    if (!clock.running || clock.endsAt === null) return
    const endsAt = clock.endsAt
    const id = setInterval(() => {
      const t = serverNow()
      setNow(t)
      const left = endsAt - t
      const sec = Math.max(0, Math.ceil(left / 1000))
      if (sec !== lastSecond.current) {
        lastSecond.current = sec
        if (sec === 10) {
          if (sound) beep(660, 150)
          vibrate(80)
        } else if (sec > 0 && sec <= 5) {
          if (sound) wntBeep()
        } else if (sec === 0) {
          if (sound) playTimeUp()
          vibrate([250, 100, 250])
        }
      }
      if (left <= 0) dispatch({ type: 'expire' })
    }, 100)
    return () => clearInterval(id)
  }, [clock.running, clock.endsAt, sound, dispatch])

  // Session duration, updated every second.
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000)
    return () => clearInterval(id)
  }, [])

  // Turn handed to this phone's player from another phone: buzz so they look up.
  const mySide = sideOf(s, meId)
  const myTurn = mySide !== null && s.turn === mySide
  const lastTap = useRef(0)
  const prevTurn = useRef(s.turn)
  const [alerting, setAlerting] = useState(false)
  useEffect(() => {
    const was = prevTurn.current
    prevTurn.current = s.turn
    if (!mySide || was === s.turn || s.turn !== mySide) return
    if (wallClock() - lastTap.current < 1500) return // Tapped here, no need to alert.
    vibrate([120, 80, 120])
    if (sound) beep(880, 180)
    setAlerting(true)
    const id = setTimeout(() => setAlerting(false), 2400)
    return () => clearTimeout(id)
  }, [s.turn, mySide, sound])

  const left = remainingAt(clock, now)
  const seconds = Math.ceil(left / 1000)
  const expired = !clock.running && clock.remainingMs <= 0
  const level = expired || seconds <= 5 ? 'danger' : seconds <= 10 ? 'warn' : 'ok'
  const progress = clock.totalMs ? left / clock.totalMs : 0
  const rack = s.racksA + s.racksB + 1
  const name = (side: Side) => (side === 'A' ? s.playerA : s.playerB)
  const racks = (side: Side) => (side === 'A' ? s.racksA : s.racksB)
  const canExtend = !s.extUsed[s.turn]
  const hasRacks = s.rackWinners.length > 0

  // Every control is a user gesture, so it's a good moment to allow audio.
  function act(action: SessionAction) {
    unlockAudio()
    lastSecond.current = null
    lastTap.current = wallClock()
    dispatch(action)
  }

  function timed(type: 'toggle' | 'nextShot' | 'switchTurn' | 'extension') {
    act({ type, now: timestamp() })
  }

  function rackWon(side: Side) {
    setRackOpen(false)
    act({ type: 'rackWon', side, now: timestamp() })
    const id = toast.add({
      title: `Rack ${rack} untuk ${name(side)}`,
      description: `${s.playerA} ${s.racksA + (side === 'A' ? 1 : 0)} – ${
        s.racksB + (side === 'B' ? 1 : 0)
      } ${s.playerB}`,
      timeout: 6000,
      // Top of the screen, so the shot clock buttons stay usable.
      placement: 'top',
      action: {
        label: 'Batalkan',
        onClick: () => {
          dispatch({ type: 'undoRack' })
          toast.close(id)
        },
      },
    })
  }

  return (
    <Dialog
      fullScreen
      open
      // Lets keyboard focus reach the toast's "Batalkan" button.
      disableEnforceFocus
      onClose={() => setEndOpen(true)}
      aria-label="Sesi bermain"
      slotProps={{ paper: { className: 'session' } }}
    >
      <header className="session__top">
        <IconButton aria-label="Akhiri sesi" onClick={() => setEndOpen(true)}>
          <CloseIcon />
        </IconButton>
        <div className="session__title">
          <span>Rack {rack}</span>
          <small>{formatDuration(now - s.startedAt)}</small>
          <small className="session__sync" data-status={sync} role="status">
            {SYNC_LABEL[sync]}
          </small>
        </div>
        <IconButton
          aria-label={sound ? 'Matikan suara' : 'Nyalakan suara'}
          aria-pressed={sound}
          onClick={() => {
            unlockAudio()
            onToggleSound()
          }}
        >
          {sound ? <SoundIcon /> : <MuteIcon />}
        </IconButton>
      </header>

      <div className="session__players">
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            className="session-player"
            aria-pressed={s.turn === side}
            aria-label={`${name(side)}, ${racks(side)} rack${s.turn === side ? ', sedang giliran' : ''}. Ketuk untuk jadikan giliran.`}
            onClick={() => act({ type: 'setTurn', side })}
          >
            <span className="session-player__name">
              <PlayerBall name={name(side)} size="sm" />
              <span>{name(side)}</span>
            </span>
            <span className="session-player__racks">{racks(side)}</span>
            <span className="session-player__ext" data-used={s.extUsed[side] ? '' : undefined}>
              {s.extUsed[side] ? 'Extension terpakai' : 'Extension siap'}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="shot-clock"
        data-level={level}
        data-running={clock.running ? '' : undefined}
        onClick={() => timed('toggle')}
        aria-label={`${seconds} detik. ${clock.running ? 'Jeda' : 'Mulai'} shot clock`}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="shot-clock__track" cx="50" cy="50" r="46" />
          <circle
            className="shot-clock__ring"
            cx="50"
            cy="50"
            r="46"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - Math.min(1, progress))}
          />
        </svg>
        <span className="shot-clock__num" aria-live="off">
          {seconds}
        </span>
        <span className="shot-clock__hint">
          {expired ? 'Waktu habis!' : clock.running ? 'Ketuk untuk jeda' : 'Ketuk untuk mulai'}
        </span>
      </button>

      <p className="session__turn" data-mine={myTurn ? '' : undefined} data-alert={alerting ? '' : undefined}>
        {myTurn ? (
          <b>Giliran kamu!</b>
        ) : (
          <>
            Giliran <b>{name(s.turn)}</b>
          </>
        )}
      </p>

      <div className="session__controls">
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ResetIcon />}
          onClick={() => timed('nextShot')}
        >
          Pukulan baru
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<SwapIcon />}
          onClick={() => timed('switchTurn')}
        >
          Ganti giliran
        </Button>
        <Button
          className="session__wide"
          variant="outlined"
          startIcon={<PlusIcon />}
          disabled={!canExtend}
          onClick={() => timed('extension')}
        >
          {canExtend
            ? `Extension +${s.extSeconds} detik`
            : `Extension ${name(s.turn)} sudah dipakai`}
        </Button>
        <Button
          className="session__wide"
          variant="contained"
          size="large"
          startIcon={<FlagIcon />}
          onClick={() => setRackOpen(true)}
        >
          Rack {rack} selesai
        </Button>
      </div>

      {/* Who won the rack? */}
      <Dialog
        open={rackOpen}
        onClose={() => setRackOpen(false)}
        aria-labelledby="rack-title"
        slotProps={{ paper: { sx: { m: 2, width: '100%', maxWidth: 380 } } }}
      >
        <DialogTitle id="rack-title">Siapa menang rack {rack}?</DialogTitle>
        <DialogContent className="rack-pick">
          {SIDES.map((side) => (
            <Button
              key={side}
              variant="outlined"
              color="inherit"
              size="large"
              onClick={() => rackWon(side)}
            >
              <PlayerBall name={name(side)} size="sm" />
              <span className="rack-pick__name">{name(side)}</span>
            </Button>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setRackOpen(false)}>
            Batal
          </Button>
        </DialogActions>
      </Dialog>

      {/* End session: with racks played, show the stats before saving. */}
      {hasRacks ? (
        <SummaryDialog
          open={endOpen}
          onClose={() => setEndOpen(false)}
          title="Akhiri sesi?"
          subtitle="Ringkasan main sejauh ini"
          summary={summarize(s.log, s.startedAt, now)}
          playerA={s.playerA}
          playerB={s.playerB}
          actions={
            <>
              <Button variant="outlined" color="inherit" onClick={() => setEndOpen(false)}>
                Lanjut main
              </Button>
              {!localOnly && (
                <Button variant="outlined" color="inherit" onClick={onLeave}>
                  Tutup di HP ini
                </Button>
              )}
              <Button variant="outlined" color="error" onClick={() => onEnd(false)}>
                Buang
              </Button>
              <Button
                className="summary-dialog__primary"
                variant="contained"
                size="large"
                onClick={() => onEnd(true)}
              >
                Simpan ke riwayat
              </Button>
            </>
          }
        />
      ) : (
        <Dialog
          open={endOpen}
          onClose={() => setEndOpen(false)}
          aria-labelledby="end-title"
          aria-describedby="end-description"
          slotProps={{ paper: { sx: { m: 2, maxWidth: 400 } } }}
        >
          <DialogTitle id="end-title">Akhiri sesi?</DialogTitle>
          <DialogContent>
            <DialogContentText id="end-description">
              Belum ada rack yang selesai, jadi tidak ada skor yang disimpan. Sesi juga
              berakhir di HP lain yang sedang membukanya.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
            <Button color="inherit" onClick={() => setEndOpen(false)}>
              Lanjut main
            </Button>
            {!localOnly && (
              <Button color="inherit" onClick={onLeave}>
                Tutup di HP ini
              </Button>
            )}
            <Button variant="contained" color="error" onClick={() => onEnd(false)}>
              Akhiri
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  )
}
