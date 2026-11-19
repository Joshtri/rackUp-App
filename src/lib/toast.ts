import { createContext, useContext } from 'react'

export type ToastOptions = {
  title: string
  description?: string
  type?: 'error'
  /** ms; default 4000. null = stays until closed */
  timeout?: number | null
  action?: { label: string; onClick: () => void }
  /** default 'bottom' (above the floating buttons) */
  placement?: 'top' | 'bottom'
}

export type ToastApi = {
  add: (toast: ToastOptions) => number
  close: (id: number) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast harus dipakai di dalam <ToastProvider>')
  return api
}
