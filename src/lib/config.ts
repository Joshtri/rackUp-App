/** Settings read from VITE_* env vars at build time (see .env.example). */

const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')
if (!apiUrl && import.meta.env.DEV) {
  console.warn('VITE_API_URL is not set; using http://localhost:8080')
}

export const API_URL = apiUrl || 'http://localhost:8080'

const loginPath = import.meta.env.VITE_LOGIN_PATH?.trim()
/** Hidden login page. Not linked from anywhere in the UI. */
export const LOGIN_PATH = loginPath?.startsWith('/') ? loginPath : '/login-secret'
