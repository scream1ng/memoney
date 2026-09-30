import { useRef, useState, type PointerEvent } from 'react'

/** Drag a sheet's header down to dismiss; interrupted gestures always snap back. */
export function useDragClose(onClose: () => void, disabled = false, animateDismiss = false) {
  const [dy, setDy] = useState(0)
  const gesture = useRef<{ id: number; y: number; distance: number } | null>(null)
  const reset = () => { gesture.current = null; setDy(0) }
  return {
    style: { transform: dy ? `translateY(${dy}px)` : undefined, transition: dy ? 'none' : undefined },
    handlers: {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (disabled || !e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest('button, input, label, a, select, textarea')) return
        gesture.current = { id: e.pointerId, y: e.clientY, distance: 0 }
        e.currentTarget.setPointerCapture(e.pointerId)
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const g = gesture.current
        if (!g || g.id !== e.pointerId) return
        if (disabled) { reset(); return }
        g.distance = Math.max(0, e.clientY - g.y)
        setDy(g.distance)
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        const g = gesture.current
        if (!g || g.id !== e.pointerId) return
        const distance = Math.max(0, e.clientY - g.y)
        if (!disabled && distance > 100) {
          if (animateDismiss) { gesture.current = null; setDy(distance) }
          else reset()
          onClose()
        } else reset()
      },
      onPointerCancel: reset,
      onLostPointerCapture() { if (gesture.current) reset() },
    },
  }
}
