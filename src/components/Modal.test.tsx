import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

const state = vi.hoisted(() => ({
  dialog: { showModal: vi.fn(), close: vi.fn() },
  cleanup: undefined as undefined | (() => void),
}))
vi.mock('react', () => ({
  useRef: () => ({ current: state.dialog }),
  useEffect: (effect: () => () => void) => { state.cleanup = effect() },
}))
const trigger = { isConnected: true, focus: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  trigger.isConnected = true
  vi.stubGlobal('document', { activeElement: trigger })
})
afterEach(() => vi.unstubAllGlobals())

it('opens with native modality and restores focus without scrolling on cleanup', () => {
  Modal({ onDismiss: vi.fn() })
  expect(state.dialog.showModal).toHaveBeenCalledOnce()
  state.cleanup!()
  expect(state.dialog.close).toHaveBeenCalledOnce()
  expect(trigger.focus).toHaveBeenCalledWith({ preventScroll: true })
})

it('does not focus a trigger removed during navigation', () => {
  Modal({ onDismiss: vi.fn() })
  trigger.isConnected = false
  state.cleanup!()
  expect(trigger.focus).not.toHaveBeenCalled()
})

it('allows Escape dismissal but keeps a busy operation open', () => {
  const close = vi.fn(), preventDefault = vi.fn()
  const idle = Modal({ onDismiss: close })
  idle.props.onCancel({ preventDefault })
  expect(close).toHaveBeenCalledOnce()
  const busy = Modal({ onDismiss: close, busy: true })
  busy.props.onCancel({ preventDefault })
  expect(close).toHaveBeenCalledOnce()
  expect(preventDefault).toHaveBeenCalledTimes(2)
})

it('dismisses only backdrop clicks, never content clicks or a busy backdrop', () => {
  const close = vi.fn()
  const dialog = { getBoundingClientRect: () => ({ left: 10, right: 100, top: 10, bottom: 100 }) }
  const event = { currentTarget: dialog, target: dialog, clientX: 5, clientY: 5, stopPropagation: vi.fn() }
  const idle = Modal({ onDismiss: close })
  idle.props.onClick({ ...event, clientX: 50, clientY: 50 })
  idle.props.onClick({ ...event, target: {} })
  expect(close).not.toHaveBeenCalled()
  idle.props.onClick(event)
  expect(close).toHaveBeenCalledOnce()
  Modal({ onDismiss: close, busy: true }).props.onClick(event)
  expect(close).toHaveBeenCalledOnce()
})
