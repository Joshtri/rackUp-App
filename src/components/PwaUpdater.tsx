import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../lib/toast'

const CHECK_EVERY_MS = 60 * 60 * 1000

// Registers the service worker and asks before switching to a new version.
export function PwaUpdater() {
  const toast = useToast()
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // An installed app may stay open for days, so check for updates now and then.
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {})
      }, CHECK_EVERY_MS)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    toast.add({ title: 'Siap dipakai offline', placement: 'top' })
  }, [offlineReady, toast])

  useEffect(() => {
    if (!needRefresh) return
    toast.add({
      title: 'Versi baru tersedia',
      description: 'Data dan sesi tetap aman.',
      timeout: null,
      placement: 'top',
      action: { label: 'Muat ulang', onClick: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, toast, updateServiceWorker])

  return null
}
