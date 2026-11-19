# Authentication & API integration

RackUp is a private app. All data lives on the RackUp API (`../rackUp-api`, Rust + Neon Postgres). Every page needs a login, and the login page sits at a hidden URL that nothing in the app links to.

## How it works

```
Browser                                   rackUp-api                        Postgres
───────                                   ──────────                        ────────
/login-secret  ── POST /auth/login ─────▶ check Argon2id hash  ───────────▶ users
               ◀── { token, expiresAt, user }   refuse if account expired
store session in localStorage
/              ── GET /auth/me ─────────▶ verify JWT + read expires_at ───▶ users
               ── GET /matches ─────────▶ (same check on every request)
               ◀── 401 account_expired / unauthorized  →  logout → /login-secret?reason=…
```

1. **Login.** The user opens the hidden login page (`VITE_LOGIN_PATH`, default `/login-secret`) and enters username + password. The API checks the password against an Argon2id hash. It returns a JWT (HS256) plus the account.
2. **Session.** The session (`token`, `expiresAt`, `user`) is saved in `localStorage` under `rackup:session:v1`, so it survives reloads and app restarts. Every API request sends `Authorization: Bearer <token>`.
3. **Route guard.** `AuthGate` wraps the whole app:
   - A visitor who was never logged in on this device gets a plain **404 page** on every path. Nothing points to the login page; only people sent the link can reach it.
   - Someone whose session just ended (logout, expiry, rejected token) already knows the link, so they are taken back to the login page with the reason. After a reload they see the 404 like everyone else.
   - With a stored session, the app waits on `GET /auth/me` ("Memeriksa sesi…") before showing anything. This checks the token and account on the server. If the server can't be reached at all, the stored session is trusted until it expires, so the shot clock still works offline.
   - A logged-in user who opens the login page is sent back to `/`.
4. **Expiry (30 days per account).**
   - Each account has an `expires_at` in the database, set to 30 days from creation.
   - Login is refused after that date (`401 account_expired`).
   - The token's `exp` is never later than the account's expiry, so a token can't outlive its account.
   - Every protected request re-reads `expires_at` from the database, so an account that expires, or is ended or renewed by the admin, takes effect on the next request.
   - The frontend also sets a timer for whichever comes first, token expiry or account expiry, and logs out when it fires. It re-checks when the tab becomes visible again.
5. **Unauthorized handling.** Any API response `401` on a request that carried a token logs the user out:
   - `account_expired` → `/login-secret?reason=expired`, message *"Akun kamu sudah kedaluwarsa…"*.
   - Anything else → `?reason=session`, message *"Sesi kamu sudah berakhir…"*.
6. **Logout.** Menu `⋯` → *Keluar* clears the stored session and goes to `?reason=logout`. Logging in or out in one tab does the same in the other open tabs.

### Why localStorage and not an HttpOnly cookie

The API runs on its own domain (a separate Vercel project) and authenticates with a bearer token. An HttpOnly cookie would have to be a cross-site cookie (`SameSite=None; Secure`), which Safari and other privacy-focused browsers block by default, so login would break there. The trade-off: a script injected into the page (XSS) could read the token. This is mitigated by React escaping all output, by keeping no third-party scripts besides Google Fonts CSS, and by tokens that last at most 30 days and stop working as soon as the account is ended.

To switch to cookies later, serve the API from the same site as the frontend, e.g. a rewrite of `/api/*` on the frontend's domain. Then let the API set a `SameSite=Lax; HttpOnly; Secure` cookie. Only `src/lib/api/client.ts` (send `credentials: 'include'` instead of the header) and `AuthProvider` (no stored token) would change.

### What "hidden" means here

- The login page is not linked in the menu or anywhere in the UI.
- `index.html` has `<meta name="robots" content="noindex, nofollow">`.
- The path is configurable per deployment (`VITE_LOGIN_PATH`).
- Logged-out visitors see a 404 page, not the login page, so the path is only known to people who were sent the link.
- It is still not a real secret: the path is in the JS bundle, and the 404 is shown by the app (the HTTP status is still 200 on a static host). Security comes from the accounts and passwords, not from the URL.

## Accounts

There is **no sign-up endpoint**. Accounts are managed with the API's admin CLI, run from a machine that has the database URL in `rackUp-api/.env`:

```bash
cd ../rackUp-api
cargo run -- user create <username> --name "Display Name"   # prints a generated password ONCE
cargo run -- user list                                       # usernames, status, expiry
cargo run -- user renew <username> [--days 30]               # expires N days from now (also revives)
cargo run -- user expire <username>                          # ends it now, open sessions stop on next request
cargo run -- user reset-password <username>                  # prints a new generated password ONCE
```

- Usernames are lowercase, 3–32 characters (`a-z 0-9 . _ -`). Login ignores case.
- Generated passwords look like `Xk7mP-q2Wd9-…`: 20 random characters (~116 bits) from the OS random generator, with no look-alike characters.
- The database stores only the Argon2id hash. The plain password is printed once and never stored or logged.

Current accounts (created 2026-11-03, expire 2026-12-03): `joshtri`, `jeremy`.

## Environment variables

Frontend (`.env.local` for dev, build env on the host; see [`.env.example`](../.env.example)):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8080` | Base URL of rackUp-api, no trailing slash |
| `VITE_LOGIN_PATH` | `/login-secret` | Path of the hidden login page |

These end up in the public bundle, so never put secrets here.

Backend (see `rackUp-api/.env.example`): `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (migrations + CLI), `JWT_SECRET` (≥ 32 chars), `JWT_TTL_DAYS` (default 30, max token life), `CORS_ORIGINS` (**must include the frontend's origin**, e.g. `https://rackup.vercel.app`).

## API endpoints used

| Method | Path | Used by |
| --- | --- | --- |
| POST | `/auth/login` | Login page |
| GET | `/auth/me` | Session check on app load |
| GET | `/matches` | Load history (and refresh after edits/imports). Only your own and your friends' matches; each has `canEdit` |
| POST | `/matches` | Record a match, save a shot-clock session, undo a delete (client sends `id` + `createdAt`, so retries are safe) |
| PUT | `/matches/{id}` | Edit a match |
| DELETE | `/matches/{id}` | Delete a match |
| POST | `/matches/import` | Import a backup file, upload old on-device data (batches of 5,000) |
| GET | `/friends` | Friends dialog, invitation banner (polled every 60 s) |
| POST | `/friends/requests` | Invite by username |
| POST | `/friends/requests/{id}/accept` | Accept an invitation |
| DELETE | `/friends/requests/{id}` | Decline / cancel an invitation |
| DELETE | `/friends/{userId}` | Remove a friend |

`GET /players` and `GET /matches/{id}` exist but the app doesn't need them. The player list comes from the loaded matches. Both are covered by the connection check.

## Code map

```
src/lib/config.ts           VITE_* settings
src/lib/api/client.ts       fetch wrapper: base URL, bearer token, timeout, ApiError, 401 hook, Indonesian messages
src/lib/api/auth.ts         login, me + User/AuthSession types
src/lib/api/matches.ts      matches endpoints
src/lib/auth.ts             AuthContext, useAuth(), session storage helpers
src/lib/router.ts           tiny History-API router (useLocation, navigate)
src/lib/matches.ts          useMatches(): API-backed, optimistic, rollback + "Coba lagi" on failure
src/components/AuthProvider.tsx  session restore, server check, auto logout, cross-tab sync
src/components/AuthGate.tsx      route guard
src/components/LoginPage.tsx     hidden login page
scripts/check-api.ts        end-to-end API check (below)
```

## Error handling & loading states

- `request()` turns every failure into an `ApiError`: `status` (0 for network/timeout), `code` (from the API), and a user-facing Indonesian `message`. Requests time out after 20 s.
- First load shows a spinner. If it fails, there's an error card with *Coba lagi*.
- Add, edit and delete show up right away. If the server refuses one, it is rolled back and an error toast offers *Coba lagi*. 401s skip the toast because the app is already going to the login page.
- Matches saved in the browser by the old offline-only version are not uploaded automatically. If any exist, the menu shows *Unggah data di perangkat ini (N)*, which imports them into the logged-in account and then clears them from the device.

## Testing the connection

```bash
API_URL=https://<api-host> API_USERNAME=joshtri API_PASSWORD='…' bun scripts/check-api.ts
# optional: ORIGIN=https://<frontend-host> to check CORS for production,
#           EXPIRED_USERNAME / EXPIRED_PASSWORD to check an expired account is refused
```

It checks 23–24 things across every endpoint. Test records are deleted at the end.

### Results (2026-11-03)

- **Local API + Neon database**: all checks passed for `joshtri` and for `jeremy`.
  - Typical latency from Indonesia to Neon `ap-southeast-1`: 150–700 ms.
  - Login takes about 0.8 s. That's the Argon2id hash, which is deliberately slow.
- **Local API + throwaway Postgres**: all checks passed, including an expired account → `401 account_expired`.
  - Also checked by hand: `user expire` while the user is logged in → the same token gets `401 account_expired` on the next request. After `user renew` → `200` again.
- **Browser end to end** (headless Edge, dev server against the local API): 22/22 passed:
  - logged-out visitors get a 404 on any path, with no link to the login page (re-checked after this change)
  - wrong password message
  - login, then saving a match through the UI and seeing it again after reload
  - menu shows the account and its expiry
  - login page redirects to the app when logged in
  - admin expiry while logged in → sent to login with the "expired" message, token removed, login refused
  - renew, then auto logout when the token runs out
  - tampered token rejected
  - manual logout
- Backend unit tests: 17 passed. Clippy and oxlint clean, `tsc -b` + `vite build` succeed.

### Issues found and fixed

| Issue | Fix |
| --- | --- |
| Backend had public `POST /auth/register` with email login and no account expiry | Removed sign-up. Added `username` + `expires_at` (migration `20261103000000`), the admin CLI, and expiry checks on login and on every request |
| A token could outlive its account | Token `exp` = min(now + `JWT_TTL_DAYS`, account expiry) |
| `setTimeout` can't wait 30 days (max ~24.8) | Auto-logout timer re-arms in ≤ 1-day steps and re-checks when the tab becomes visible |
| Neon database had never been migrated (`relation "users" does not exist`) | Ran `cargo run -- migrate`, then created the two accounts |
| A malformed date in a request body comes back as `422 bad_request` (JSON parser), not `validation_error` | Expected API behavior. The check script now sends well-formed but invalid data to test validation |
| Opening `/login-secret` directly on a static host returns 404 | Added `vercel.json` SPA rewrite. The PWA service worker already falls back to `index.html` |

## Extending

- **Another protected page:** render it inside `<AuthGate>`. It's protected automatically. For several pages, swap `src/lib/router.ts` for React Router and keep `AuthGate` as the layout route's guard.
- **Another endpoint:** add a function in `src/lib/api/<feature>.ts` using `request()`. The token, timeout, errors and 401 handling come for free.
- **Different account length:** `--days N` on `user create` / `user renew`, or `DEFAULT_ACCOUNT_DAYS` in `rackUp-api/src/features/auth/accounts.rs`.
- **Self-service password change, roles, etc.:** add routes under `rackUp-api/src/features/auth/` and reuse `hash_password` and the `AuthUser` extractor.
