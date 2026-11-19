/**
 * Checks that the backend works end to end with a real account.
 * Creates a few test records and deletes them again at the end.
 *
 *   API_URL=http://localhost:8080 API_USERNAME=joshtri API_PASSWORD=... bun scripts/check-api.ts
 *
 * Optional: ORIGIN (default http://localhost:5173) to check CORS for that origin,
 * EXPIRED_USERNAME / EXPIRED_PASSWORD to check an expired account is refused.
 */

const base = (process.env.API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
const username = process.env.API_USERNAME
const password = process.env.API_PASSWORD
const origin = process.env.ORIGIN ?? 'http://localhost:5173'
if (!username || !password) {
  console.error('Set API_USERNAME and API_PASSWORD.')
  process.exit(2)
}

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

type Res = { status: number; body: any; ms: number; headers: Headers }
async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<Res> {
  const started = performance.now()
  const res = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  return {
    status: res.status,
    body: text ? JSON.parse(text) : null,
    ms: Math.round(performance.now() - started),
    headers: res.headers,
  }
}
const info = (r: Res) => `${r.status}, ${r.ms} ms`

console.log(`API: ${base}\n`)

// --- Public endpoints
let r = await call('GET', '/health')
check('GET /health', r.status === 200 && r.body?.status === 'ok', info(r))
r = await call('GET', '/ready')
check('GET /ready (database reachable)', r.status === 200, info(r))

// --- CORS preflight, as the browser sends it
const pre = await fetch(base + '/matches', {
  method: 'OPTIONS',
  headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type',
  },
})
check(
  `CORS allows ${origin}`,
  pre.headers.get('access-control-allow-origin') === origin,
  `allow-origin: ${pre.headers.get('access-control-allow-origin') ?? 'none'}`,
)

// --- Auth failures
r = await call('POST', '/auth/login', { body: { username, password: password + 'x' } })
check('wrong password → 401 invalid_credentials', r.status === 401 && r.body?.error?.code === 'invalid_credentials', info(r))
r = await call('POST', '/auth/login', { body: { username: 'no-such-user-xyz', password } })
check('unknown user → 401 invalid_credentials', r.status === 401 && r.body?.error?.code === 'invalid_credentials', info(r))
r = await call('GET', '/matches')
check('no token → 401 unauthorized', r.status === 401 && r.body?.error?.code === 'unauthorized', info(r))
r = await call('GET', '/matches', { token: 'not.a.token' })
check('bad token → 401 unauthorized', r.status === 401 && r.body?.error?.code === 'unauthorized', info(r))
r = await call('POST', '/auth/register', { body: { username: 'x', password: 'y' } })
check('public sign-up is disabled → 404', r.status === 404, info(r))

if (process.env.EXPIRED_USERNAME && process.env.EXPIRED_PASSWORD) {
  r = await call('POST', '/auth/login', {
    body: { username: process.env.EXPIRED_USERNAME, password: process.env.EXPIRED_PASSWORD },
  })
  check('expired account → 401 account_expired', r.status === 401 && r.body?.error?.code === 'account_expired', info(r))
}

// --- Login
r = await call('POST', '/auth/login', { body: { username: username.toUpperCase(), password } })
check('login (username is case-insensitive)', r.status === 200 && typeof r.body?.token === 'string', info(r))
const token: string = r.body?.token
if (!token) {
  console.log('\nCannot continue without a token.')
  process.exit(1)
}
const user = r.body.user
check(
  'token expiry ≤ account expiry',
  r.body.expiresAt <= user.expiresAt,
  `token ${new Date(r.body.expiresAt).toISOString()}, account ${new Date(user.expiresAt).toISOString()}`,
)
const daysLeft = (user.expiresAt - Date.now()) / 86_400_000
check('account expires within 30 days', daysLeft > 0 && daysLeft <= 30.01, `${daysLeft.toFixed(1)} days left`)

r = await call('GET', '/auth/me', { token })
check('GET /auth/me', r.status === 200 && r.body?.username === username.toLowerCase(), info(r))

// --- Matches CRUD (test records are deleted at the end)
const tag = `api-check ${new Date().toISOString()}`
const id = crypto.randomUUID()
const createdAt = Date.now()
r = await call('POST', '/matches', {
  token,
  body: { id, createdAt, date: '2026-01-15', playerA: 'Tes A', playerB: 'Tes B', scoreA: 3, scoreB: 5, note: tag },
})
check('POST /matches', r.status === 201 && r.body?.id === id && r.body?.createdAt === createdAt, info(r))
r = await call('POST', '/matches', {
  token,
  body: { id, createdAt, date: '2026-01-15', playerA: 'Tes A', playerB: 'Tes B', scoreA: 3, scoreB: 5, note: tag },
})
check('POST /matches same id again (undo-safe) → 200', r.status === 200, info(r))
r = await call('GET', `/matches/${id}`, { token })
check('GET /matches/{id}', r.status === 200 && r.body?.note === tag, info(r))
r = await call('PUT', `/matches/${id}`, {
  token,
  body: { date: '2026-01-16', playerA: 'Tes A', playerB: 'Tes B', scoreA: 6, scoreB: 5, note: tag },
})
check('PUT /matches/{id}', r.status === 200 && r.body?.scoreA === 6, info(r))
r = await call('PUT', `/matches/${id}`, {
  token,
  body: { date: '2026-01-16', playerA: '', playerB: 'B', scoreA: 1, scoreB: 0 },
})
check('PUT with bad data → 422 validation_error', r.status === 422 && r.body?.error?.code === 'validation_error', info(r))
r = await call('GET', '/matches', { token })
check('GET /matches lists it', r.status === 200 && r.body.some((m: { id: string }) => m.id === id), `${info(r)}, ${r.body?.length} records`)
r = await call('GET', '/players', { token })
check('GET /players', r.status === 200 && r.body.includes('Tes A'), info(r))

const importId = crypto.randomUUID()
r = await call('POST', '/matches/import', {
  token,
  body: {
    matches: [
      { id, createdAt, date: '2026-01-15', playerA: 'Tes A', playerB: 'Tes B', scoreA: 1, scoreB: 0 },
      { id: importId, createdAt: Date.now(), date: '2026-01-14', playerA: 'Tes A', playerB: 'Tes B', scoreA: 2, scoreB: 2, note: tag },
    ],
  },
})
check('POST /matches/import merges by id', r.status === 200 && r.body?.added === 1 && r.body?.skipped === 1, `${info(r)}, ${JSON.stringify(r.body)}`)

// --- Clean up
for (const mid of [id, importId]) {
  r = await call('DELETE', `/matches/${mid}`, { token })
  check(`DELETE /matches/${mid.slice(0, 8)}…`, r.status === 204, info(r))
}
r = await call('GET', `/matches/${id}`, { token })
check('deleted record → 404 not_found', r.status === 404, info(r))

console.log(`\n${failed ? `${failed} check(s) failed` : 'All checks passed'}`)
process.exit(failed ? 1 : 0)
