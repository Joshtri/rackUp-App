import { API_URL } from '../config'

/**
 * Error from the API (`{ error: { code, message } }`) or from the network.
 * `status` is 0 when the request never got a response (offline, timeout, CORS).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  get isNetwork() {
    return this.status === 0
  }
}

const TIMEOUT_MS = 20_000

// Auth wiring, set by AuthProvider. Kept here so every request picks it up
// without each call site passing the token around.
let authToken: string | null = null
let onUnauthorized: (error: ApiError) => void = () => {}

export function setAuthToken(token: string | null) {
  authToken = token
}

/** Called when a request that carried a token gets 401 (expired, revoked, account ended). */
export function setUnauthorizedHandler(handler: (error: ApiError) => void) {
  onUnauthorized = handler
}

type RequestOptions = {
  body?: unknown
  /** Send the bearer token (default true). */
  auth?: boolean
  signal?: AbortSignal
}

/** JSON request to the API. Throws ApiError on any failure. */
export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  { body, auth = true, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? authToken : null
  if (token) headers.Authorization = `Bearer ${token}`

  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    const timedOut = timeout.aborted
    throw new ApiError(
      0,
      timedOut ? 'timeout' : 'network_error',
      timedOut
        ? 'Server tidak merespons. Coba lagi sebentar lagi.'
        : 'Tidak bisa terhubung ke server. Cek koneksi internet.',
    )
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null)
  if (res.ok) return data as T

  const apiError = (data as { error?: { code?: string; message?: string } } | null)?.error
  const error = new ApiError(
    res.status,
    apiError?.code ?? 'http_error',
    messageFor(res.status, apiError?.code) ?? apiError?.message ?? `HTTP ${res.status}`,
  )
  // A protected request was refused: the session is no longer valid.
  if (res.status === 401 && token) onUnauthorized(error)
  throw error
}

/** Indonesian messages for the codes the UI shows. */
function messageFor(status: number, code?: string): string | undefined {
  switch (code) {
    case 'invalid_credentials':
      return 'Username atau password salah.'
    case 'account_expired':
      return 'Akun kamu sudah kedaluwarsa. Hubungi admin untuk memperpanjang.'
    case 'unauthorized':
      return 'Sesi kamu sudah berakhir. Silakan masuk lagi.'
    case 'not_found':
      return 'Data tidak ditemukan. Mungkin sudah dihapus.'
    case 'forbidden':
      return 'Hanya pemain dan yang mencatat yang bisa mengubah catatan ini.'
    case 'user_not_found':
      return 'Username tidak ditemukan. Cek lagi ejaannya.'
    case 'already_friends':
      return 'Kalian sudah berteman.'
  }
  if (status >= 500) return 'Server sedang bermasalah. Coba lagi sebentar lagi.'
  return undefined
}

/** Readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = 'Terjadi kesalahan.') {
  return err instanceof Error && err.message ? err.message : fallback
}
