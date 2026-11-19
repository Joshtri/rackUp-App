import { useSyncExternalStore } from 'react'

/*
 * Tiny router: the app has only the main page and the hidden login page,
 * so a full router library isn't needed. Uses the History API.
 */

const NAVIGATE_EVENT = 'app:navigate'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

/** Current URL path + query, re-rendering on navigation. */
export function useLocation() {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search)
  const url = new URL(href, location.origin)
  return { pathname: url.pathname, searchParams: url.searchParams }
}

export function navigate(to: string, { replace = false } = {}) {
  if (to === location.pathname + location.search) return
  history[replace ? 'replaceState' : 'pushState'](null, '', to)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}
