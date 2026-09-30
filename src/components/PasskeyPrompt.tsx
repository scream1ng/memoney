import { Fingerprint } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDragClose } from '../hooks/useDragClose'
import { authClient } from '../lib/auth'

export function PasskeyPrompt({ userId }: { userId: string }) {
  const key = `memoney.passkey-prompt:${userId}`
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    try { if (localStorage.getItem(key)) return } catch { /* try again next sign-in */ }
    let active = true
    authClient.passkey.listUserPasskeys().then(({ data, error }) => {
      if (!active || error || !data) return
      if (data?.length) {
        try { localStorage.setItem(key, '1') } catch { /* ignore */ }
      } else setOpen(true)
    }).catch(() => {})
    return () => { active = false }
  }, [key])

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    else if (!open && dialog.current?.open) dialog.current.close()
  }, [open])

  const dismiss = () => {
    try { localStorage.setItem(key, '1') } catch { /* ignore */ }
    setOpen(false)
  }
  const drag = useDragClose(dismiss, busy)
  const add = async () => {
    setBusy(true)
    setError(false)
    try {
      const result = await authClient.passkey.addPasskey()
      if (result?.error) setError(true)
      else dismiss()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="passkey-prompt" style={drag.style} aria-labelledby="passkey-title" aria-describedby="passkey-description" onCancel={(e) => { e.preventDefault(); if (!busy) dismiss() }}>
    <div className="modal-handle" {...drag.handlers}>
      <Fingerprint size={32} aria-hidden />
      <h2 id="passkey-title">Set up a passkey?</h2>
      <p id="passkey-description">Sign in next time with Face ID, Touch ID, or your device passcode.</p>
    </div>
    {error && <p className="error" role="alert">Couldn’t set up your passkey. Try again.</p>}
    <button className="primary" onClick={add} disabled={busy}>{busy ? 'Setting up…' : 'Set up passkey'}</button>
    <button onClick={dismiss} disabled={busy}>Maybe later</button>
  </dialog>
}
