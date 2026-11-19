const LOCALE = 'id-ID'

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local date as YYYY-MM-DD. */
export function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const todayISO = () => toISODate(new Date())

/** 75_000 → "1:15", 3_725_000 → "1:02:05" */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 2_820_000 → "47 menit", 4_500_000 → "1 jam 15 menit" */
export function formatMinutes(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} menit`
  return m ? `${h} jam ${m} menit` : `${h} jam`
}

const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' })
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })
const fullDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatWeekday = (iso: string) => weekdayShort.format(parseDate(iso))
export const formatMonth = (iso: string) => monthYear.format(parseDate(iso))
export const formatFullDate = (iso: string) => fullDate.format(parseDate(iso))
export const formatShortDate = (iso: string) => shortDate.format(parseDate(iso))
export const dayOfMonth = (iso: string) => parseDate(iso).getDate()

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
