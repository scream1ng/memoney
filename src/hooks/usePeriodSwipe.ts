import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'

const MIN_DX = 60

/** Which way a horizontal swipe goes: +1 next period (swipe left), -1 previous, 0 not a swipe. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * 2) return 0
  return dx < 0 ? 1 : -1
}

/**
 * Swipe the header/totals left or right to step the Day/Week/Month. Vertical moves stay page scrolls.
 * `go` is also what the arrow buttons call, so both slide the totals in from the same side.
 */
export function usePeriodSwipe(shift: (delta: number) => void) {
  const [dir, setDir] = useState<'next' | 'prev'>()
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const swiped = useRef(false)
  const go = (delta: number) => {
    setDir(delta > 0 ? 'next' : 'prev')
    shift(delta)
  }
  return {
    go,
    /** class for the part that slides in after a step */
    slide: dir ? `period-slide ${dir}` : '',
    handlers: {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (!e.isPrimary || e.button !== 0) return
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
        swiped.current = false
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        const s = start.current
        start.current = null
        if (!s || s.id !== e.pointerId) return
        const step = swipeStep(e.clientX - s.x, e.clientY - s.y)
        if (!step) return
        swiped.current = true
        go(step)
      },
      onPointerCancel() { start.current = null },
      // a swipe that began on a button (e.g. the Day/Week/Month toggle) must not also press it
      onClickCapture(e: MouseEvent<HTMLElement>) {
        if (!swiped.current) return
        swiped.current = false
        e.preventDefault()
        e.stopPropagation()
      },
    },
  }
}
