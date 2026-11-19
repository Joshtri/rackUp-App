import Autocomplete from '@mui/material/Autocomplete'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import { PlayerBall } from './PlayerBall'

/** Free-text player name with suggestions from earlier matches. */
export function PlayerInput({
  label,
  value,
  onChange,
  players,
  error,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  players: string[]
  error: string | null
  /** Shown under the field when there's no error. */
  hint?: string
}) {
  return (
    <Autocomplete
      freeSolo
      openOnFocus
      options={players}
      inputValue={value}
      onInputChange={(_, v) => onChange(v)}
      renderOption={({ key, ...props }, name) => (
        <li key={key} {...props}>
          <PlayerBall name={name} size="sm" />
          {name}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Nama"
          error={!!error}
          helperText={error ?? hint}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <PlayerBall name={value || '?'} size="sm" />
                </InputAdornment>
              ),
            },
            htmlInput: { ...params.slotProps.htmlInput, autoComplete: 'off' },
          }}
        />
      )}
    />
  )
}
