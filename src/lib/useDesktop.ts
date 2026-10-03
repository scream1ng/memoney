import { useSyncExternalStore } from 'react'

// Desktop web gets the landing page and dashboard; phones and the installed app keep the mobile UI.
const QUERIES = ['(min-width: 820px)', '(display-mode: standalone)'].map((q) => window.matchMedia(q))

const isDesktop = () => QUERIES[0].matches && !QUERIES[1].matches && !(navigator as { standalone?: boolean }).standalone

function subscribe(fn: () => void) {
  QUERIES.forEach((q) => q.addEventListener('change', fn))
  return () => QUERIES.forEach((q) => q.removeEventListener('change', fn))
}

export function useDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktop)
}
