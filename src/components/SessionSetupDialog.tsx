import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { accountFor } from '../lib/accounts'
import type { Account } from '../lib/api/users'
import type { SessionSettings } from '../lib/session'
import { PlayIcon, SwapIcon } from './icons'
import { PlayerInput } from './PlayerInput'
import { SheetDialog } from './SheetDialog'

const SHOT_PRESETS = [15, 20, 30, 45, 60]
const EXT_PRESETS = [15, 30, 45, 60]

export type PlayerLinks = { userA: string | null; userB: string | null }

type Props = {
  open: boolean
  onClose: () => void
  /** Changing this resets the form. */
  formKey: number
  initialPlayers: [string, string]
  settings: SessionSettings
  players: string[]
  /** Active accounts. A player whose name matches one is linked to it. */
  accounts: Account[]
  /** The logged-in account. */
  meId: string | undefined
  onStart: (playerA: string, playerB: string, settings: SessionSettings, links: PlayerLinks) => void
}

export function SessionSetupDialog({ open, onClose, formKey, ...rest }: Props) {
  return (
    <SheetDialog
      open={open}
      onClose={onClose}
      title="Mulai sesi"
      description="Pemain 1 break duluan. Pemain yang punya akun bisa gabung dari HP masing-masing."
    >
      <SetupForm key={formKey} onCancel={onClose} {...rest} />
    </SheetDialog>
  )
}

function linkHint(account: Account | null, meId: string | undefined) {
  if (!account) return 'Tamu, tanpa akun'
  if (account.id === meId) return 'Akun kamu'
  return `Akun @${account.username}: dapat tanda giliran di HP-nya`
}

function SetupForm({
  initialPlayers,
  settings,
  players,
  accounts,
  meId,
  onStart,
  onCancel,
}: Omit<Props, 'open' | 'onClose' | 'formKey'> & { onCancel: () => void }) {
  const [playerA, setPlayerA] = useState(initialPlayers[0])
  const [playerB, setPlayerB] = useState(initialPlayers[1])
  const [shotSeconds, setShotSeconds] = useState(settings.shotSeconds)
  const [extSeconds, setExtSeconds] = useState(settings.extSeconds)
  const [submitted, setSubmitted] = useState(false)
  const shotId = useId()
  const extId = useId()

  // Account names first, then names from the history.
  const suggestions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const name of [...accounts.map((a) => a.displayName), ...players]) {
      const key = name.toLowerCase()
      if (!seen.has(key)) seen.set(key, name)
    }
    return [...seen.values()]
  }, [accounts, players])

  const a = playerA.trim()
  const b = playerB.trim()
  const accountA = accountFor(a, accounts)
  const accountB = accountFor(b, accounts)
  const errors = {
    playerA: !a ? 'Isi nama pemain.' : null,
    playerB: !b
      ? 'Isi nama pemain.'
      : a && a.toLowerCase() === b.toLowerCase()
        ? 'Nama pemain harus beda.'
        : null,
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (errors.playerA || errors.playerB) return
    onStart(
      // An account's player keeps the account's spelling.
      accountA?.displayName ?? a,
      accountB?.displayName ?? b,
      { ...settings, shotSeconds, extSeconds },
      { userA: accountA?.id ?? null, userB: accountB?.id ?? null },
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogContent className="match-form" sx={{ p: 0, overflow: 'visible' }}>
        <div className="players-grid">
          <PlayerInput
            label="Pemain 1"
            value={playerA}
            onChange={setPlayerA}
            players={suggestions.filter((p) => p !== b)}
            error={submitted ? errors.playerA : null}
            hint={a ? linkHint(accountA, meId) : undefined}
          />
          <IconButton
            className="swap-button"
            onClick={() => {
              setPlayerA(playerB)
              setPlayerB(playerA)
            }}
            aria-label="Tukar posisi pemain"
            title="Tukar posisi"
          >
            <SwapIcon />
          </IconButton>
          <PlayerInput
            label="Pemain 2"
            value={playerB}
            onChange={setPlayerB}
            players={suggestions.filter((p) => p !== a)}
            error={submitted ? errors.playerB : null}
            hint={b ? linkHint(accountB, meId) : undefined}
          />
        </div>

        <SecondsPicker
          id={shotId}
          label="Shot clock per giliran"
          value={shotSeconds}
          options={SHOT_PRESETS}
          onChange={setShotSeconds}
        />
        <SecondsPicker
          id={extId}
          label="Extension (1× per pemain tiap rack)"
          value={extSeconds}
          options={EXT_PRESETS}
          onChange={setExtSeconds}
        />
      </DialogContent>

      <DialogActions sx={{ p: 0, mt: 2.5, gap: 1 }}>
        <Button color="inherit" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" variant="contained" startIcon={<PlayIcon />}>
          Mulai
        </Button>
      </DialogActions>
    </form>
  )
}

function SecondsPicker({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: number
  options: number[]
  onChange: (v: number) => void
}) {
  return (
    <div className="seconds-picker">
      <p id={id} className="field-label">
        {label}
      </p>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={value}
        onChange={(_, v: number | null) => v !== null && onChange(v)}
        aria-labelledby={id}
        size="small"
      >
        {options.map((s) => (
          <ToggleButton key={s} value={s} aria-label={`${s} detik`}>
            {s}s
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  )
}
