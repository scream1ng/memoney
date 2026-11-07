import { useEffect, useRef, useState } from 'react'

export const PULL_TRIGGER = 64
const MAX_PULL = 96

/** Finger travel → how far the spinner moves: half speed, capped. */
export const damp = (dy: number) => Math.min(MAX_PULL, Math.max(0, dy) * 0.5)

/**
 * Pull down from the very top of the page to refresh. The spinner is moved directly (no re-render per frame);
 * nothing starts while a sheet is open or the page is scrolled.
 */
export function usePullRefresh(onRefresh: () => Promise<unknown>) {
  const indicator = useRef<HTMLDivElement>(null)
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)
  const latest = useRef(onRefresh)
  useEffect(() => { latest.current = onRefresh })

  useEffect(() => {
    let start: { x: number; y: number } | null = null
    let pull = 0
    const place = (px: number, animate: boolean) => {
      const el = indicator.current
      if (!el) return
      el.style.transition = animate ? '' : 'none'
      el.style.transform = `translateY(${px}px) rotate(${px * 4}deg)`
      el.style.opacity = String(Math.min(1, px / PULL_TRIGGER))
    }
    const onStart = (e: TouchEvent) => {
      start = null
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1 || document.querySelector('dialog[open]')) return
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      pull = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!start) return
      const dy = e.touches[0].clientY - start.y
      // sideways first: it's a period swipe or a row swipe, not a pull
      if (!pull && Math.abs(e.touches[0].clientX - start.x) > Math.abs(dy)) { start = null; return }
      pull = damp(dy)
      place(pull, false)
    }
    const onEnd = () => {
      if (!start) return
      start = null
      if (pull < PULL_TRIGGER) { place(0, true); return }
      busy.current = true
      setRefreshing(true)
      place(PULL_TRIGGER * 0.75, true)
      void latest.current().finally(() => {
        busy.current = false
        setRefreshing(false)
        place(0, true)
      })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return { indicator, refreshing }
}
