import { Check, ChevronRight, Coins, Fingerprint, Grid2X2, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Usage } from './Usage'
import { authClient } from '../lib/auth'
import { currencyAtom, useAtom } from '../lib/store'

const CURRENCIES = ['', '฿', '$', '€', '£', '¥', '₫', 'RM']

export function Settings() {
  const navigate = useNavigate()
  const [cur, setCur] = useAtom(currencyAtom)
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)
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
        <button className="row between" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="row"><span className="ico" style={{ background: '#ff9500' }}><Coins size={18} /></span>Currency</span>
          <span className="val">{cur || '–'}<ChevronRight size={18} style={{ transform: open ? 'rotate(90deg)' : undefined }} /></span>
        </button>
        {open && (
          <div className="cur">
            {CURRENCIES.map((c) => (
              <button key={c} aria-pressed={cur === c} aria-label={c || 'None'} onClick={() => setCur(c)}>{c || '–'}</button>
            ))}
          </div>
        )}
        <button className="row between" onClick={() => navigate('/settings/categories')}>
          <span className="row"><span className="ico" style={{ background: 'var(--accent)' }}><Grid2X2 size={18} /></span>Categories</span>
          <span className="val"><ChevronRight size={18} /></span>
        </button>
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
    </main>
  )
}
