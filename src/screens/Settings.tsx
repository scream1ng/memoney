import { Check, ChevronRight, Coins, Fingerprint, Grid2X2, LogOut, Shield, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useDragClose } from '../hooks/useDragClose'
import { Usage } from './Usage'
import { authClient } from '../lib/auth'
import { currencyAtom, useAtom } from '../lib/store'

const CURRENCIES = ['', '฿', '$', '€', '£', '¥', '₫', 'RM']
const CURRENCY_NAMES = ['None', 'Thai baht', 'US dollar', 'Euro', 'British pound', 'Japanese yen', 'Vietnamese dong', 'Malaysian ringgit']

export function Settings({ admin }: { admin: boolean }) {
  const navigate = useNavigate()
  const [cur, setCur] = useAtom(currencyAtom)
  const [open, setOpen] = useState(false)
  const drag = useDragClose(() => setOpen(false))
  const [added, setAdded] = useState(false)
  const currencyRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [adding, setAdding] = useState(false)
  const [passkeyError, setPasskeyError] = useState('')
  const addPasskey = async () => {
    if (adding) return
    setAdding(true)
    setPasskeyError('')
    try {
      const result = await authClient.passkey.addPasskey()
      if (result?.error) setPasskeyError('Passkey setup was cancelled or failed. Try again.')
      else setAdded(true)
    } catch {
      setPasskeyError('Could not set up your passkey. Try again.')
    } finally { setAdding(false) }
  }
  // reload drops the signed-out user's transactions from memory
  const signOut = () => authClient.signOut().then(() => window.location.reload())
  return (
    <main className="screen">
      <div className="brand"><img src="/favicon.svg" alt="" />MeMoney</div>
      <Usage />
      <section className="card set">
        <button ref={currencyRef} className="row between" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          <span className="row"><span className="ico" style={{ background: '#ff9500' }}><Coins size={18} /></span>Currency</span>
          <span className="val">{cur || '–'}<ChevronRight size={18} /></span>
        </button>
        <button className="row between" onClick={() => navigate('/settings/categories')}>
          <span className="row"><span className="ico" style={{ background: 'var(--accent)' }}><Grid2X2 size={18} /></span>Categories</span>
          <span className="val"><ChevronRight size={18} /></span>
        </button>
        {admin && <button className="row between" onClick={() => navigate('/settings/admin')}>
          <span className="row"><span className="ico" style={{ background: 'var(--accent)' }}><Shield size={18} /></span>Admin Panel</span>
          <span className="val"><ChevronRight size={18} /></span>
        </button>}
      </section>
      <section className="card set">
        <button className="row between" onClick={addPasskey} disabled={added || adding}>
          <span className="row"><span className="ico" style={{ background: 'var(--accent)' }}><Fingerprint size={18} /></span>{adding ? 'Setting up passkey…' : added ? 'Passkey added' : 'Add passkey'}</span>
          <span className="val">{added ? <Check size={18} /> : <ChevronRight size={18} />}</span>
        </button>
      </section>
      {passkeyError && <p className="warn" role="alert">{passkeyError}</p>}
      {adding && <p className="sr" role="status">Setting up passkey…</p>}
      <section className="card set">
        <button className="row danger" onClick={signOut}>
          <span className="ico" style={{ background: 'var(--exp)' }}><LogOut size={18} /></span>Sign out
        </button>
      </section>
      {open && <Modal onDismiss={() => setOpen(false)} style={drag.style} className="currency-sheet" aria-labelledby="currency-title">
          <div className="modal-handle" {...drag.handlers}>
            <div className="grab" aria-hidden />
            <div className="currency-head"><h2 id="currency-title">Currency</h2><button ref={closeRef} aria-label="Close currency" onClick={() => setOpen(false)}><X size={20} /></button></div>
          </div>
          <div className="card currency-options">
            {CURRENCIES.map((c, i) => <button key={c} aria-pressed={cur === c} onClick={() => { setCur(c); setOpen(false) }}>
              <strong>{c || '–'}</strong><span>{CURRENCY_NAMES[i]}</span>{cur === c && <Check size={20} />}
            </button>)}
          </div>
      </Modal>}
    </main>
  )
}
