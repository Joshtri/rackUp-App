import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import TextField from '@mui/material/TextField'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import { useId, useState, type FormEvent } from 'react'
import type { MatchInput } from '../lib/matches'
import { MinusIcon, PlusIcon, SwapIcon } from './icons'
import { PlayerInput } from './PlayerInput'
import { SheetDialog } from './SheetDialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'new' | 'edit'
  /** Changing this resets the form (pass a new value each time the dialog opens). */
  formKey: number
  initial: MatchInput
  players: string[]
  onSave: (input: MatchInput) => void
}

export function MatchDialog({ open, onOpenChange, mode, formKey, initial, players, onSave }: Props) {
  const close = () => onOpenChange(false)

  return (
    <SheetDialog
      open={open}
      onClose={close}
      title={mode === 'new' ? 'Catat main' : 'Edit catatan'}
      description="Siapa main, tanggal berapa, skornya berapa."
    >
      <MatchForm
        key={formKey}
        mode={mode}
        initial={initial}
        players={players}
        onCancel={close}
        onSave={(input) => {
          onSave(input)
          close()
        }}
      />
    </SheetDialog>
  )
}

type FormProps = Pick<Props, 'mode' | 'initial' | 'players' | 'onSave'> & { onCancel: () => void }

function MatchForm({ mode, initial, players, onSave, onCancel }: FormProps) {
  const [date, setDate] = useState(initial.date)
  const [playerA, setPlayerA] = useState(initial.playerA)
  const [playerB, setPlayerB] = useState(initial.playerB)
  const [scoreA, setScoreA] = useState<number | null>(mode === 'edit' ? initial.scoreA : null)
  const [scoreB, setScoreB] = useState<number | null>(mode === 'edit' ? initial.scoreB : null)
  const [note, setNote] = useState(initial.note ?? '')
  const [submitted, setSubmitted] = useState(false)
  const scoreLegendId = useId()

  const a = playerA.trim()
  const b = playerB.trim()
  const errors = {
    date: !date ? 'Pilih tanggal main.' : null,
    playerA: !a ? 'Isi nama pemain.' : null,
    playerB: !b
      ? 'Isi nama pemain.'
      : a && a.toLowerCase() === b.toLowerCase()
        ? 'Nama pemain harus beda.'
        : null,
    score: !scoreA && !scoreB ? 'Skornya belum diisi.' : null,
  }
  const hasError = Object.values(errors).some(Boolean)
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (hasError) return
    onSave({
      date,
      playerA: a,
      playerB: b,
      scoreA: scoreA ?? 0,
      scoreB: scoreB ?? 0,
      note: note.trim() || undefined,
    })
  }

  function swap() {
    setPlayerA(playerB)
    setPlayerB(playerA)
    setScoreA(scoreB)
    setScoreB(scoreA)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogContent className="match-form" sx={{ p: 0, overflow: 'visible' }}>
        <DatePicker
          label="Tanggal"
          value={date ? dayjs(date) : null}
          onChange={(v) => setDate(v?.isValid() ? v.format('YYYY-MM-DD') : '')}
          format="dddd, D MMM YYYY"
          slotProps={{
            textField: {
              fullWidth: true,
              error: !!show('date'),
              helperText: show('date'),
            },
          }}
        />

        <div className="players-grid">
          <PlayerInput
            label="Pemain 1"
            value={playerA}
            onChange={setPlayerA}
            players={players.filter((p) => p !== playerB.trim())}
            error={show('playerA')}
          />
          <IconButton
            className="swap-button"
            onClick={swap}
            aria-label="Tukar posisi pemain"
            title="Tukar posisi"
          >
            <SwapIcon />
          </IconButton>
          <PlayerInput
            label="Pemain 2"
            value={playerB}
            onChange={setPlayerB}
            players={players.filter((p) => p !== playerA.trim())}
            error={show('playerB')}
          />
        </div>

        <div
          className="score-board"
          role="group"
          aria-labelledby={scoreLegendId}
          data-invalid={show('score') ? '' : undefined}
        >
          <p id={scoreLegendId} className="field-label">
            Skor (jumlah rack menang)
          </p>
          <div className="score-board__row">
            <ScoreInput name={a || 'Pemain 1'} value={scoreA} onChange={setScoreA} />
            <span className="score-board__dash" aria-hidden="true">
              –
            </span>
            <ScoreInput name={b || 'Pemain 2'} value={scoreB} onChange={setScoreB} />
          </div>
          {show('score') && <p className="field-error">{errors.score}</p>}
        </div>

        <TextField
          label="Catatan (opsional)"
          placeholder="Misal: race to 7, kalah taruhan es teh"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 140 } }}
        />
      </DialogContent>

      <DialogActions sx={{ p: 0, mt: 2.5, gap: 1 }}>
        <Button color="inherit" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" variant="contained">
          {mode === 'new' ? 'Simpan' : 'Simpan perubahan'}
        </Button>
      </DialogActions>
    </form>
  )
}

function ScoreInput({
  name,
  value,
  onChange,
}: {
  name: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  const MIN = 0
  const MAX = 99
  const set = (v: number | null) => onChange(v === null ? null : Math.min(MAX, Math.max(MIN, v)))

  return (
    <div className="score-input">
      <span className="score-input__name" title={name}>
        {name}
      </span>
      <div className="score-input__group">
        <IconButton
          className="score-input__step"
          aria-label={`Kurangi skor ${name}`}
          disabled={value === null || value <= MIN}
          onClick={() => set((value ?? 0) - 1)}
        >
          <MinusIcon />
        </IconButton>
        <InputBase
          className="score-input__value"
          placeholder="0"
          value={value ?? ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '')
            set(digits ? Number(digits) : null)
          }}
          slotProps={{
            input: { inputMode: 'numeric', 'aria-label': `Skor ${name}`, maxLength: 2 },
          }}
        />
        <IconButton
          className="score-input__step"
          aria-label={`Tambah skor ${name}`}
          disabled={value !== null && value >= MAX}
          onClick={() => set((value ?? 0) + 1)}
        >
          <PlusIcon />
        </IconButton>
      </div>
    </div>
  )
}
