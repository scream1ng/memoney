import { describe, expect, it, vi } from 'vitest'
import type { MouseEvent, PointerEvent } from 'react'
import { useDeleteTap } from './useDeleteTap'
vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }) }))
const pointer = (x: number, y = 0, id = 1) => ({ clientX: x, clientY: y, pointerId: id, isPrimary: true, button: 0,
  currentTarget: { setPointerCapture: vi.fn() } }) as unknown as PointerEvent<HTMLButtonElement>
const click = (detail = 1) => ({ detail }) as MouseEvent<HTMLButtonElement>
describe('Delete requires a separate intentional activation', () => {
  it('rejects a swipe-generated click with no Delete pointerdown, even when open', () => {
    const remove = vi.fn(), handlers = useDeleteTap(remove, true)
    handlers.onPointerUp(pointer(0)); handlers.onClick(click())
    expect(remove).not.toHaveBeenCalled()
  })
  it('accepts a fresh tap on Delete only once', () => {
    const remove = vi.fn(), handlers = useDeleteTap(remove, true)
    handlers.onPointerDown(pointer(10)); handlers.onPointerUp(pointer(11)); handlers.onClick(click()); handlers.onClick(click())
    expect(remove).toHaveBeenCalledTimes(1)
  })
  it('rejects a drag on Delete, even if the finger returns to its starting point', () => {
    const remove = vi.fn(), handlers = useDeleteTap(remove, true)
    handlers.onPointerDown(pointer(0)); handlers.onPointerMove(pointer(20)); handlers.onPointerUp(pointer(0)); handlers.onClick(click())
    expect(remove).not.toHaveBeenCalled()
  })
  it('rejects a fast drag whose only displacement is in pointerup', () => {
    const remove = vi.fn(), handlers = useDeleteTap(remove, true)
    handlers.onPointerDown(pointer(0)); handlers.onPointerUp(pointer(0, 30)); handlers.onClick(click())
    expect(remove).not.toHaveBeenCalled()
  })
  it('rejects cancelled and mismatched pointers', () => {
    const remove = vi.fn(), handlers = useDeleteTap(remove, true)
    handlers.onPointerDown(pointer(0)); handlers.onPointerCancel(); handlers.onPointerUp(pointer(0)); handlers.onClick(click())
    handlers.onPointerDown(pointer(0)); handlers.onPointerUp(pointer(0, 0, 2)); handlers.onClick(click())
    expect(remove).not.toHaveBeenCalled()
  })
  it('preserves keyboard activation while blocking closed or disabled Delete', () => {
    const remove = vi.fn(), enabled = useDeleteTap(remove, true), disabled = useDeleteTap(remove, false)
    enabled.onClick(click(0)); expect(remove).toHaveBeenCalledTimes(1)
    disabled.onPointerDown(pointer(0)); disabled.onPointerUp(pointer(0)); disabled.onClick(click()); disabled.onClick(click(0))
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
