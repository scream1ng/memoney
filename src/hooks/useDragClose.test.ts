import { describe, expect, it, vi } from 'vitest'
import type { PointerEvent } from 'react'
import { useDragClose } from './useDragClose'

// Exercise the actual pointer handlers without a DOM renderer.
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }) }))
function pointer(y: number, options: { id?: number; button?: number; interactive?: boolean; primary?: boolean } = {}) {
  return {
    clientY: y, pointerId: options.id ?? 1, button: options.button ?? 0, isPrimary: options.primary ?? true,
    target: { closest: () => options.interactive ? {} : null }, currentTarget: { setPointerCapture: vi.fn(), closest: () => sheet },
  } as unknown as PointerEvent<HTMLElement>
}
const sheet = { style: { transform: '', transition: '' } }

describe('sheet drag dismissal', () => {
  it('moves the sheet itself while dragging and puts it back when let go short', () => {
    const handlers = useDragClose(vi.fn())
    handlers.onPointerDown(pointer(20)); handlers.onPointerMove(pointer(80))
    expect(sheet.style.transform).toBe('translateY(60px)')
    handlers.onPointerUp(pointer(80))
    expect(sheet.style.transform).toBe('')
  })
  it('dismisses a downward pull and uses the final pointer position even before another render', () => {
    const close = vi.fn(), handlers = useDragClose(close)
    handlers.onPointerDown(pointer(20)); handlers.onPointerUp(pointer(121))
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('keeps short and upward pulls open', () => {
    const close = vi.fn(), handlers = useDragClose(close)
    for (const y of [70, -50]) { handlers.onPointerDown(pointer(20)); handlers.onPointerMove(pointer(y)); handlers.onPointerUp(pointer(y)) }
    expect(close).not.toHaveBeenCalled()
  })
  it('never dismisses an interrupted long drag', () => {
    const close = vi.fn(), handlers = useDragClose(close)
    handlers.onPointerDown(pointer(0)); handlers.onPointerMove(pointer(200)); handlers.onPointerCancel(); handlers.onPointerUp(pointer(200))
    handlers.onPointerDown(pointer(0)); handlers.onPointerMove(pointer(200)); handlers.onLostPointerCapture(); handlers.onPointerUp(pointer(200))
    expect(close).not.toHaveBeenCalled()
  })
  it('ignores controls, secondary pointers, right clicks, and busy operations', () => {
    const close = vi.fn(), handlers = useDragClose(close)
    for (const options of [{ interactive: true }, { primary: false }, { button: 2 }]) { handlers.onPointerDown(pointer(0, options)); handlers.onPointerUp(pointer(200)) }
    const busy = useDragClose(close, true)
    busy.onPointerDown(pointer(0)); busy.onPointerUp(pointer(200))
    expect(close).not.toHaveBeenCalled()
  })
  it('ignores another pointer and resets after dismissal', () => {
    const close = vi.fn(), handlers = useDragClose(close)
    handlers.onPointerDown(pointer(0)); handlers.onPointerUp(pointer(200, { id: 2 })); expect(close).not.toHaveBeenCalled()
    handlers.onPointerUp(pointer(200)); handlers.onPointerUp(pointer(200)); expect(close).toHaveBeenCalledTimes(1)
  })
})
