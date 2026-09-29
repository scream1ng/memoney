import { Check, ChevronRight, Coins, Fingerprint, Grid2X2, LogOut, Shield, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Usage } from './Usage'
import { authClient } from '../lib/auth'
import { currencyAtom, useAtom } from '../lib/store'

const CURRENCIES = ['', '฿', '$', '€', '£', '¥', '₫', 'RM']
const CURRENCY_NAMES = ['None', 'Thai baht', 'US dollar', 'Euro', 'British pound', 'Japanese yen', 'Vietnamese dong', 'Malaysian ringgit']

export function Settings({ admin }: { admin: boolean }) {
  const navigate = useNavigate()
  const [cur, setCur] = useAtom(currencyAtom)
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const currencyRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const trigger = currencyRef.current
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); trigger?.focus() }
  }, [open])
  const addPasskey = async () => {
    const r = await authClient.passkey.addPasskey()
    if (!r?.error) setAdded(true)
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
        <button className="row between" onClick={addPasskey} disabled={added}>
          <span className="row"><span className="ico" style={{ background: 'var(--accent)' }}><Fingerprint size={18} /></span>Add passkey</span>
          <span className="val">{added ? <Check size={18} /> : <ChevronRight size={18} />}</span>
        </button>
      </section>
      <section className="card set">
        <button className="row danger" onClick={signOut}>
          <span className="ico" style={{ background: 'var(--exp)' }}><LogOut size={18} /></span>Sign out
        </button>
      </section>
      {open && <div className="currency-wrap" onClick={() => setOpen(false)}>
        <section className="currency-sheet" role="dialog" aria-modal="true" aria-labelledby="currency-title" onClick={(event) => event.stopPropagation()}>
          <div className="grab" />
          <div className="currency-head"><h2 id="currency-title">Currency</h2><button ref={closeRef} aria-label="Close currency" onClick={() => setOpen(false)}><X size={20} /></button></div>
          <div className="card currency-options">
            {CURRENCIES.map((c, i) => <button key={c} aria-pressed={cur === c} onClick={() => { setCur(c); setOpen(false) }}>
              <strong>{c || '–'}</strong><span>{CURRENCY_NAMES[i]}</span>{cur === c && <Check size={20} />}
            </button>)}
          </div>
        </section>
      </div>}
    </main>
  )
}
