import { useRef, type MouseEvent, type PointerEvent } from 'react'

/** A swipe's synthetic click must never count as a fresh tap on Delete. */
export function useDeleteTap(onDelete: () => void, enabled: boolean) {
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean; released: boolean } | null>(null)
  const reset = () => { gesture.current = null }
  const moved = (e: PointerEvent<HTMLButtonElement>, g: NonNullable<typeof gesture.current>) =>
    Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10
  return {
    onPointerDown(e: PointerEvent<HTMLButtonElement>) {
      reset()
      if (!enabled || !e.isPrimary || e.button !== 0) return
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, released: false }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove(e: PointerEvent<HTMLButtonElement>) {
      const g = gesture.current
      if (g?.id === e.pointerId && moved(e, g)) g.moved = true
    },
    onPointerUp(e: PointerEvent<HTMLButtonElement>) {
      const g = gesture.current
      if (g?.id !== e.pointerId || g.released) return
      g.moved ||= moved(e, g)
      g.released = true
      if (enabled && !g.moved) onDelete()
    },
    onPointerCancel: reset,
    onKeyDown: reset,
    onClick(e: MouseEvent<HTMLButtonElement>) {
      const g = gesture.current
      // Keyboard and assistive technology activation have no pointer click count.
      const deliberate = e.detail === 0 && !g
      reset()
      if (enabled && deliberate) onDelete()
    },
  }
}
