import { useRef, type PointerEvent } from 'react'

/**
 * Drag a sheet's header down to dismiss; interrupted gestures always snap back.
 * Moves the enclosing <dialog> directly, so a drag never re-renders the sheet's contents.
 */
export function useDragClose(onClose: () => void, disabled = false, animateDismiss = false) {
  const gesture = useRef<{ id: number; y: number; sheet: HTMLElement | null } | null>(null)
  const move = (sheet: HTMLElement | null | undefined, dy: number) => {
    if (!sheet) return
    sheet.style.transition = dy ? 'none' : ''
    sheet.style.transform = dy ? `translateY(${dy}px)` : ''
  }
  const reset = () => {
    move(gesture.current?.sheet, 0)
    gesture.current = null
  }
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (disabled || !e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest('button, input, label, a, select, textarea')) return
      gesture.current = { id: e.pointerId, y: e.clientY, sheet: e.currentTarget.closest('dialog') }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      if (disabled) { reset(); return }
      move(g.sheet, Math.max(0, e.clientY - g.y))
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      const distance = Math.max(0, e.clientY - g.y)
      if (!disabled && distance > 100) {
        // the closing animation starts from where the finger let go
        if (animateDismiss) gesture.current = null
        else reset()
        onClose()
      } else reset()
    },
    onPointerCancel: reset,
    onLostPointerCapture() { if (gesture.current) reset() },
  }
}
