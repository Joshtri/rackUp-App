import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import { useState, type FormEvent, type ReactNode } from 'react'
import { errorMessage } from '../lib/api/client'
import type { Account } from '../lib/api/users'
import type { FriendsState } from '../lib/friends'
import { useToast } from '../lib/toast'
import { CheckIcon, CloseIcon, TrashIcon } from './icons'
import { PlayerBall } from './PlayerBall'
import { SheetDialog } from './SheetDialog'

/** Invite friends by username, answer invitations, and manage the friends list. */
export function FriendsDialog({
  open,
  onClose,
  friends,
}: {
  open: boolean
  onClose: () => void
  friends: FriendsState
}) {
  return (
    <SheetDialog
      open={open}
      onClose={onClose}
      title="Teman"
      description="Kamu dan temanmu saling melihat riwayat, statistik, dan sesi yang sedang berjalan."
    >
      <FriendsPanel friends={friends} />
    </SheetDialog>
  )
}

function FriendsPanel({ friends: f }: { friends: FriendsState }) {
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  /** Runs one action at a time; `key` marks which button shows the spinner. */
  async function act(key: string, call: () => Promise<unknown>, done?: string) {
    setBusy(key)
    try {
      await call()
      if (done) toast.add({ title: done })
      return true
    } catch (err) {
      toast.add({ title: 'Gagal', description: errorMessage(err), type: 'error' })
      return false
    } finally {
      setBusy(null)
    }
  }

  async function submitInvite(e: FormEvent) {
    e.preventDefault()
    const name = username.trim().replace(/^@/, '')
    if (!name) return
    setInviteError(null)
    setBusy('invite')
    try {
      const next = await f.invite(name)
      setUsername('')
      const nowFriends = next.friends.some((x) => x.username === name.toLowerCase())
      toast.add({
        title: nowFriends ? 'Sekarang kalian berteman' : 'Undangan terkirim',
        description: nowFriends
          ? `@${name.toLowerCase()} sudah mengundang kamu duluan.`
          : `Tunggu @${name.toLowerCase()} menerimanya.`,
      })
    } catch (err) {
      setInviteError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="friends">
      <form className="friends__invite" onSubmit={submitInvite} noValidate>
        <TextField
          label="Undang lewat username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setInviteError(null)
          }}
          error={!!inviteError}
          helperText={inviteError ?? 'Minta username temanmu, lalu kirim undangan.'}
          size="small"
          fullWidth
          slotProps={{
            htmlInput: { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          loading={busy === 'invite'}
          disabled={!username.trim() || (busy !== null && busy !== 'invite')}
        >
          Undang
        </Button>
      </form>

      {f.incoming.length > 0 && (
        <Section title="Undangan masuk" count={f.incoming.length}>
          {f.incoming.map((r) => (
            <Person key={r.id} account={r.user} note="Ingin berteman denganmu">
              <Button
                size="small"
                variant="contained"
                startIcon={<CheckIcon />}
                loading={busy === `accept:${r.id}`}
                disabled={busy !== null}
                onClick={() =>
                  act(`accept:${r.id}`, () => f.accept(r.id), `Sekarang kamu berteman dengan ${r.user.displayName}`)
                }
              >
                Terima
              </Button>
              <IconButton
                size="small"
                aria-label={`Tolak undangan dari ${r.user.displayName}`}
                disabled={busy !== null}
                onClick={() => act(`dismiss:${r.id}`, () => f.dismiss(r.id), 'Undangan ditolak')}
              >
                <CloseIcon />
              </IconButton>
            </Person>
          ))}
        </Section>
      )}

      <Section title="Teman" count={f.friends.length}>
        {f.friends.length === 0 ? (
          <p className="friends__empty">
            {f.loaded
              ? 'Belum ada teman. Undang temanmu supaya bisa saling lihat skor.'
              : 'Memuat…'}
          </p>
        ) : (
          f.friends.map((x) =>
            confirmRemove === x.id ? (
              <Person key={x.id} account={x} note="Hapus dari teman?">
                <Button
                  size="small"
                  color="error"
                  variant="contained"
                  loading={busy === `remove:${x.id}`}
                  disabled={busy !== null}
                  onClick={async () => {
                    if (await act(`remove:${x.id}`, () => f.remove(x.id), `${x.displayName} dihapus dari teman`))
                      setConfirmRemove(null)
                  }}
                >
                  Hapus
                </Button>
                <Button size="small" color="inherit" onClick={() => setConfirmRemove(null)}>
                  Batal
                </Button>
              </Person>
            ) : (
              <Person key={x.id} account={x}>
                <IconButton
                  size="small"
                  aria-label={`Hapus ${x.displayName} dari teman`}
                  disabled={busy !== null}
                  onClick={() => setConfirmRemove(x.id)}
                >
                  <TrashIcon />
                </IconButton>
              </Person>
            ),
          )
        )}
      </Section>

      {f.outgoing.length > 0 && (
        <Section title="Menunggu jawaban" count={f.outgoing.length}>
          {f.outgoing.map((r) => (
            <Person key={r.id} account={r.user} note="Undangan terkirim">
              <Button
                size="small"
                color="inherit"
                loading={busy === `dismiss:${r.id}`}
                disabled={busy !== null}
                onClick={() => act(`dismiss:${r.id}`, () => f.dismiss(r.id), 'Undangan dibatalkan')}
              >
                Batalkan
              </Button>
            </Person>
          ))}
        </Section>
      )}

      <p className="friends__note">
        Tulis nama pemain sama dengan nama akun temanmu, supaya match-nya terhubung ke akun itu.
        Match hanya bisa diedit oleh pemainnya dan yang mencatat.
      </p>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="friends__section">
      <h3 className="friends__title">
        {title}
        <span>{count}</span>
      </h3>
      <ul className="friends__list">{children}</ul>
    </section>
  )
}

function Person({ account, note, children }: { account: Account; note?: string; children: ReactNode }) {
  return (
    <li className="friends__person">
      <PlayerBall name={account.displayName} size="sm" />
      <span className="friends__who">
        <strong>{account.displayName}</strong>
        <small>
          @{account.username}
          {note && ` · ${note}`}
        </small>
      </span>
      <span className="friends__actions">{children}</span>
    </li>
  )
}
