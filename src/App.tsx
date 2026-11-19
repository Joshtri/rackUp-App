import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import CircularProgress from '@mui/material/CircularProgress'
import Fab from '@mui/material/Fab'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { HistoryList } from './components/HistoryList'
import { LiveSessionsBanner } from './components/LiveSessionsBanner'
import {
  DownloadIcon,
  EightBall,
  LogoutIcon,
  PlusIcon,
  TimerIcon,
  UploadIcon,
} from './components/icons'
import { MatchDialog } from './components/MatchDialog'
import { MoreMenu } from './components/MoreMenu'
import { PlayerBall } from './components/PlayerBall'
import { SessionScreen } from './components/SessionScreen'
import { SessionSetupDialog } from './components/SessionSetupDialog'
import { SummaryDialog } from './components/SessionSummary'
import { StatsView } from './components/StatsView'
import {
  formatFullDate,
  formatMinutes,
  formatShortDate,
  todayISO,
  toISODate,
} from './lib/format'
import { errorMessage } from './lib/api/client'
import { useAuth } from './lib/auth'
import {
  clearLocalMatches,
  loadLocalMatches,
  parseBackup,
  useMatches,
  type Match,
  type MatchInput,
} from './lib/matches'
import { useAccounts } from './lib/accounts'
import type { LiveSession } from './lib/api/liveSessions'
import { liveSession, useActiveSessions, useLiveSession, type LiveEvent } from './lib/liveSession'
import { serverNow } from './lib/serverClock'
import {
  createSession,
  loadSettings,
  saveSettings,
  type SessionSettings,
} from './lib/session'
import type { PlayerLinks } from './components/SessionSetupDialog'
import { unlockAudio } from './lib/sound'
import { summarize } from './lib/sessionStats'
import { pairStats } from './lib/stats'
import { useToast } from './lib/toast'

// Outside the component so the linter sees it is only used in event handlers.
// Server time: a shared session's times must mean the same on every phone.
const timestamp = () => serverNow()

export default function App() {
  const {
    matches,
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
  } = useMatches()
  const { user, logout } = useAuth()
  const toast = useToast()
  // Matches saved in this browser before the app used the API.
  const [localMatches, setLocalMatches] = useState(loadLocalMatches)
  const [tab, setTab] = useState<'history' | 'stats'>('history')

  // Add / edit dialog. `editing` stays set while the dialog animates out.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Match | null>(null)
  const [formKey, setFormKey] = useState(0)

  // Delete confirmation.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const topPair = useMemo(() => pairStats(matches)[0], [matches])
  const totalRacks = useMemo(
    () => matches.reduce((sum, m) => sum + m.scoreA + m.scoreB, 0),
    [matches],
  )

  const last = matches[0]
  const initial: MatchInput = editing ?? {
    date: todayISO(),
    playerA: last?.playerA ?? '',
    playerB: last?.playerB ?? '',
    scoreA: 0,
    scoreB: 0,
  }

  function openNew() {
    setEditing(null)
    setFormKey((k) => k + 1)
    setDialogOpen(true)
  }

  function openEdit(m: Match) {
    setEditing(m)
    setFormKey((k) => k + 1)
    setDialogOpen(true)
  }

  function handleSave(input: MatchInput) {
    if (editing) {
      update(editing.id, input)
      toast.add({ title: 'Catatan diperbarui' })
    } else {
      add(input)
      toast.add({
        title: 'Tersimpan',
        description: `${input.playerA} ${input.scoreA} – ${input.scoreB} ${input.playerB}`,
      })
    }
  }

  // Live play session (shot clock), shared with the other phones through the API.
  const accounts = useAccounts()
  const onLiveEvent = useCallback(
    (e: LiveEvent) => {
      if (e.type === 'ended') {
        // This phone's end went through (or another phone's end was first).
        settle(e.session.id, e.savedMatchId === e.session.id)
        if (e.error) {
          const { session: s } = e
          toast.add({
            title: 'Sesi gagal disimpan',
            description: `${s.playerA} ${s.racksA} – ${s.racksB} ${s.playerB}. Catat manual lewat "Catat skor". (${e.error})`,
            type: 'error',
            timeout: null,
          })
        }
        return
      }
      const { session: s, byName, saved } = e
      void refresh()
      toast.add({
        title: byName ? `Sesi diakhiri oleh ${byName}` : 'Sesi sudah diakhiri',
        description: saved
          ? `Skor disimpan: ${s.playerA} ${s.racksA} – ${s.racksB} ${s.playerB}`
          : 'Skornya tidak disimpan.',
      })
    },
    [refresh, settle, toast],
  )
  const live = useLiveSession(onLiveEvent)
  const session = live.session
  const activeSessions = useActiveSessions(!session)
  const [sessionSettings, setSessionSettings] = useState(loadSettings)
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupKey, setSetupKey] = useState(0)

  useEffect(() => saveSettings(sessionSettings), [sessionSettings])

  const dispatchSession = liveSession.dispatch

  function joinSession(s: LiveSession) {
    unlockAudio()
    liveSession.join(s)
  }

  function openSetup() {
    setSetupKey((k) => k + 1)
    setSetupOpen(true)
  }

  function startSession(
    playerA: string,
    playerB: string,
    settings: SessionSettings,
    links: PlayerLinks,
  ) {
    unlockAudio()
    setSessionSettings(settings)
    liveSession.start(createSession(playerA, playerB, settings, { now: timestamp(), ...links }))
    setSetupOpen(false)
  }

  function endSession(save: boolean) {
    if (save && session) {
      const racks = session.racksA + session.racksB
      const endedAt = timestamp()
      const input: MatchInput = {
        date: toISODate(new Date(session.startedAt)),
        playerA: session.playerA,
        playerB: session.playerB,
        scoreA: session.racksA,
        scoreB: session.racksB,
        note: `Sesi ${racks} rack, ${formatMinutes(endedAt - session.startedAt)}`,
        log: { ...session.log, startedAt: session.startedAt, endedAt },
      }
      // Saved by the server when the session ends, with the session's id,
      // so two phones ending it at once still save it once.
      const match = build(input, session.id)
      showPending(match)
      liveSession.end(match)
      const id = toast.add({
        title: 'Sesi disimpan',
        description: `${input.playerA} ${input.scoreA} – ${input.scoreB} ${input.playerB}`,
        action: {
          label: 'Statistik',
          onClick: () => {
            openStats(match)
            toast.close(id)
          },
        },
      })
    } else {
      liveSession.end(null)
    }
  }

  // Stats of a saved session. `statsTarget` stays set while the dialog animates out.
  const [statsOpen, setStatsOpen] = useState(false)
  const [statsTarget, setStatsTarget] = useState<Match | null>(null)
  const statsSummary = useMemo(() => {
    const log = statsTarget?.log
    return log ? summarize(log, log.startedAt, log.endedAt) : null
  }, [statsTarget])

  function openStats(m: Match) {
    setStatsTarget(m)
    setStatsOpen(true)
  }

  function askDelete(m: Match) {
    setDeleteTarget(m)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const m = deleteTarget
    remove(m.id)
    setDeleteOpen(false)
    const id = toast.add({
      title: 'Catatan dihapus',
      description: `${m.playerA} ${m.scoreA} – ${m.scoreB} ${m.playerB}`,
      timeout: 7000,
      action: {
        label: 'Batalkan',
        onClick: () => {
          restore(m)
          toast.close(id)
        },
      },
    })
  }

  function exportData() {
    const payload = {
      app: 'pocket-ball-trackers',
      version: 1,
      exportedAt: new Date().toISOString(),
      matches,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `catatan-billiard-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.add({ title: 'Backup diunduh', description: `${matches.length} catatan` })
  }

  async function importData(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    try {
      await runImport(parseBackup(await file.text()))
    } catch (err) {
      toast.add({
        title: 'Gagal impor',
        description: errorMessage(err, 'File tidak bisa dibaca.'),
        type: 'error',
      })
    }
  }

  async function runImport(incoming: Match[]) {
    const loading = toast.add({ title: 'Mengimpor…', timeout: null })
    try {
      const added = await importMatches(incoming)
      toast.add({
        title: added ? 'Data diimpor' : 'Tidak ada data baru',
        description: added
          ? `${added} catatan baru ditambahkan.`
          : 'Semua catatan ini sudah ada.',
      })
    } finally {
      toast.close(loading)
    }
  }

  async function uploadLocalData() {
    try {
      await runImport(localMatches)
      clearLocalMatches()
      setLocalMatches([])
    } catch (err) {
      toast.add({ title: 'Gagal mengunggah', description: errorMessage(err), type: 'error' })
    }
  }

  const expiresOn = user
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(user.expiresAt)
    : ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <EightBall tile className="brand__logo" />
          <div>
            <h1 className="brand__title">
              Rack<span>Up</span>
            </h1>
            <p className="brand__subtitle">Skor main bareng, biar nggak ada yang ngeles.</p>
          </div>
        </div>

        <MoreMenu
          label="Menu"
          header={
            user && (
              <>
                <strong>{user.displayName}</strong>
                <span>Akun aktif s/d {expiresOn}</span>
              </>
            )
          }
          items={[
            {
              label: 'Unduh backup',
              icon: <DownloadIcon />,
              onClick: exportData,
              disabled: matches.length === 0,
            },
            {
              label: 'Impor dari file',
              icon: <UploadIcon />,
              onClick: () => fileRef.current?.click(),
              disabled: status !== 'ready',
            },
            ...(localMatches.length > 0
              ? [
                  {
                    label: `Unggah data di perangkat ini (${localMatches.length})`,
                    icon: <UploadIcon />,
                    onClick: uploadLocalData,
                    disabled: status !== 'ready',
                  },
                ]
              : []),
            { label: 'Keluar', icon: <LogoutIcon />, onClick: () => logout() },
          ]}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importData}
        />
      </header>

      <LiveSessionsBanner sessions={activeSessions} meId={user?.id} onJoin={joinSession} />

      {status === 'loading' && matches.length === 0 ? (
        <section className="empty" role="status">
          <CircularProgress size={32} />
          <p>Memuat catatan…</p>
        </section>
      ) : status === 'error' ? (
        <section className="empty" role="alert">
          <EightBall className="empty__ball" />
          <h2>Gagal memuat catatan</h2>
          <p>{loadError}</p>
          <Button variant="contained" size="large" onClick={reload}>
            Coba lagi
          </Button>
        </section>
      ) : topPair ? (
        <section className="hero" aria-label="Rekap utama">
          <p className="hero__eyebrow">Rekap head to head</p>
          <div className="hero__board">
            <div className="hero__side">
              <PlayerBall name={topPair.a} size="lg" />
              <span className="hero__name">{topPair.a}</span>
            </div>
            <div className="hero__score">
              <span data-lead={topPair.winsA > topPair.winsB ? '' : undefined}>
                {topPair.winsA}
              </span>
              <span className="hero__colon">:</span>
              <span data-lead={topPair.winsB > topPair.winsA ? '' : undefined}>
                {topPair.winsB}
              </span>
            </div>
            <div className="hero__side">
              <PlayerBall name={topPair.b} size="lg" />
              <span className="hero__name">{topPair.b}</span>
            </div>
          </div>
          <dl className="hero__facts">
            <div>
              <dt>Sesi</dt>
              <dd>{matches.length}</dd>
            </div>
            <div>
              <dt>Total rack</dt>
              <dd>{totalRacks}</dd>
            </div>
            <div>
              <dt>Main terakhir</dt>
              <dd title={formatFullDate(last.date)}>{formatShortDate(last.date)}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="empty">
          <EightBall className="empty__ball" />
          <h2>Belum ada catatan</h2>
          <p>
            Habis main, catat skornya di sini. Misal tanggal 30 kamu menang 8–6, tinggal
            masukin aja.
          </p>
          <div className="empty__actions">
            <Button variant="contained" size="large" startIcon={<TimerIcon />} onClick={openSetup}>
              Mulai sesi
            </Button>
            <Button variant="outlined" size="large" startIcon={<PlusIcon />} onClick={openNew}>
              Catat skor
            </Button>
          </div>
        </section>
      )}

      {matches.length > 0 && (
        <div className="tabs">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="fullWidth"
            className="tabs__list"
            aria-label="Tampilan"
          >
            <Tab value="history" label="Riwayat" id="tab-history" aria-controls="panel-history" />
            <Tab value="stats" label="Statistik" id="tab-stats" aria-controls="panel-stats" />
          </Tabs>
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="tabs__panel"
          >
            {tab === 'history' ? (
              <HistoryList
                matches={matches}
                onEdit={openEdit}
                onDelete={askDelete}
                onStats={openStats}
              />
            ) : (
              <StatsView matches={matches} />
            )}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="fab-dock">
          <Fab variant="extended" className="fab" data-variant="secondary" onClick={openNew}>
            <PlusIcon /> Catat skor
          </Fab>
          <Fab variant="extended" color="primary" className="fab" onClick={openSetup}>
            <TimerIcon /> Mulai sesi
          </Fab>
        </div>
      )}

      <MatchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editing ? 'edit' : 'new'}
        formKey={formKey}
        initial={initial}
        players={players}
        onSave={handleSave}
      />

      <SessionSetupDialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        formKey={setupKey}
        initialPlayers={[last?.playerA ?? user?.displayName ?? '', last?.playerB ?? '']}
        settings={sessionSettings}
        players={players}
        accounts={accounts}
        meId={user?.id}
        onStart={startSession}
      />

      {session && (
        <SessionScreen
          // A different session (joined or started) starts with fresh screen state.
          key={session.id}
          session={session}
          dispatch={dispatchSession}
          sound={sessionSettings.sound}
          onToggleSound={() => setSessionSettings((st) => ({ ...st, sound: !st.sound }))}
          onEnd={endSession}
          onLeave={liveSession.leave}
          meId={user?.id}
          sync={live.status}
          localOnly={live.localOnly}
        />
      )}

      <SummaryDialog
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        title="Statistik sesi"
        subtitle={statsTarget ? formatFullDate(statsTarget.date) : undefined}
        summary={statsSummary}
        playerA={statsTarget?.playerA ?? ''}
        playerB={statsTarget?.playerB ?? ''}
        actions={
          <Button
            className="summary-dialog__primary"
            variant="contained"
            size="large"
            onClick={() => setStatsOpen(false)}
          >
            Tutup
          </Button>
        }
      />

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        slotProps={{ paper: { role: 'alertdialog', sx: { maxWidth: 380, m: 2 } } }}
      >
        <DialogTitle id="delete-title">Hapus catatan ini?</DialogTitle>
        {deleteTarget && (
          <DialogContent>
            <DialogContentText id="delete-description">
              {deleteTarget.playerA} {deleteTarget.scoreA} – {deleteTarget.scoreB}{' '}
              {deleteTarget.playerB}, {formatFullDate(deleteTarget.date)}.
            </DialogContentText>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setDeleteOpen(false)}>
            Batal
          </Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Hapus
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
