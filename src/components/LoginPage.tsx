import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/api/client'
import { useAuth, type LogoutReason } from '../lib/auth'
import { useLocation } from '../lib/router'
import { EightBall } from './icons'

const REASON_TEXT: Record<LogoutReason, { text: string; severity: 'info' | 'warning' }> = {
  logout: { text: 'Kamu sudah keluar.', severity: 'info' },
  session: { text: 'Sesi kamu sudah berakhir. Silakan masuk lagi.', severity: 'info' },
  expired: {
    text: 'Akun kamu sudah kedaluwarsa. Hubungi admin untuk memperpanjang.',
    severity: 'warning',
  },
}

const isReason = (v: string | null): v is LogoutReason => !!v && v in REASON_TEXT

/** Hidden login page (LOGIN_PATH). Not linked from anywhere in the app. */
export function LoginPage() {
  const { login } = useAuth()
  const { searchParams } = useLocation()
  const reasonParam = searchParams.get('reason')
  const reason = isReason(reasonParam) ? REASON_TEXT[reasonParam] : null

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Masuk · RackUp'
    return () => {
      document.title = 'RackUp'
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
      // AuthGate moves on to the app.
    } catch (err) {
      setError(errorMessage(err, 'Gagal masuk.'))
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <div className="login__brand">
          <EightBall tile className="brand__logo" />
          <h1 className="brand__title">
            Rack<span>Up</span>
          </h1>
        </div>
        <p className="login__subtitle">Masuk untuk lanjut.</p>

        {error ? (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        ) : (
          reason && <Alert severity={reason.severity}>{reason.text}</Alert>
        )}

        <TextField
          label="Username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          fullWidth
          slotProps={{
            htmlInput: { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false },
          }}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={busy}
          disabled={!username.trim() || !password}
        >
          Masuk
        </Button>
      </form>
    </main>
  )
}
