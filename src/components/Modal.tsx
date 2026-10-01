import { useEffect, useRef, type ComponentProps } from 'react'

export function Modal({ onDismiss, busy = false, className = '', children, ...props }: Omit<ComponentProps<'dialog'>, 'onCancel' | 'onClick'> & {
  onDismiss: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [])
  return <dialog {...props} ref={ref} className={`modal-dialog ${className}`} onCancel={(event) => {
    event.preventDefault()
    if (!busy) onDismiss()
  }} onClick={(event) => {
    event.stopPropagation()
    if (busy || event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss()
  }}>{children}</dialog>
}
