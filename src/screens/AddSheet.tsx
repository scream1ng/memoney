import { CalendarDays, Check, Delete, LoaderCircle, PenLine, ScanLine, Store, Trash2, TriangleAlert, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { TypeToggle } from '../components/ui'
import { CATEGORIES } from '../lib/categories'
import { amountToInput, fromDateKey, money, parseAmount, today, uid } from '../lib/format'
import { scanReceipt } from '../lib/ocr'
import { currencyAtom, repo, useAtom, useTransactions } from '../lib/store'
import type { TxType } from '../lib/types'

export function AddSheet() {
  const { id } = useParams()
  const existing = useTransactions().find((t) => t.id === id)
  const navigate = useNavigate()
  const location = useLocation()
  const [symbol] = useAtom(currencyAtom)

  const [type, setType] = useState<TxType>(existing?.type ?? 'expense')
  const [input, setInput] = useState(existing ? amountToInput(existing.amount) : '')
  const [cat, setCat] = useState<string | undefined>(existing?.category)
  const [date, setDate] = useState(existing?.date ?? today())
  const [note, setNote] = useState(existing?.note ?? '')
  const [merchant, setMerchant] = useState(existing?.merchant ?? '')
  const [showNote, setShowNote] = useState(!!existing?.note)
  const [scan, setScan] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [armDelete, setArmDelete] = useState(false)
  const [hints, setHints] = useState<Set<'amount' | 'date' | 'merchant'>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const close = () => (location.state?.bg ? navigate(-1) : navigate('/', { replace: true }))
  const amount = parseAmount(input)
  const canSave = amount > 0 && !!cat

  function press(k: string) {
    setHints((h) => (h.has('amount') ? new Set([...h].filter((x) => x !== 'amount')) : h))
    setInput((cur) => {
      if (k === 'del') return cur.slice(0, -1)
      if (k === '.') return cur.includes('.') ? cur : (cur || '0') + '.'
      if (!cur || cur === '0') return k === '00' ? '0' : k
      const next = cur + k
      const [whole, dec] = next.split('.')
      if (whole.length > 9 || (dec && dec.length > 2)) return cur
      return next
    })
  }

  function switchType(t: TxType) {
    setType(t)
    if (!CATEGORIES[t].some((c) => c.id === cat)) setCat(undefined)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setScan('busy')
    try {
      const r = await scanReceipt(file)
      const found = new Set<'amount' | 'date' | 'merchant'>()
      if (r.amount) { setInput(amountToInput(r.amount)); found.add('amount') }
      if (r.date) { setDate(r.date); found.add('date') }
      if (r.merchant) { setMerchant(r.merchant); found.add('merchant') }
      setType('expense')
      setHints(found)
      setScan(found.size ? 'idle' : 'failed')
    } catch (err) {
      console.error('[scan]', err)
      setScan('failed')
    }
  }

  function save() {
    if (!canSave) return
    repo.save({
      id: existing?.id ?? uid(),
      type,
      amount,
      category: cat!,
      date,
      note: note.trim() || undefined,
      merchant: merchant.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    })
    close()
  }

  // two taps: first arms, second deletes
  function remove() {
    if (!armDelete) return setArmDelete(true)
    if (existing) repo.remove(existing.id)
    close()
  }

  const dateText = fromDateKey(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  return (
    <div className="sheet-wrap" onClick={close}>
      <div className="glass sheet" role="dialog" aria-modal="true" aria-label={existing ? 'Edit' : 'Add'} onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden />
        <div className="row between">
          <button className="icon-btn" aria-label="Close" onClick={close}><X size={22} /></button>
          <TypeToggle value={type} onChange={switchType} />
          {existing ? (
            <button
              className="icon-btn"
              aria-label={armDelete ? 'Confirm delete' : 'Delete'}
              style={armDelete ? { background: 'var(--exp)', color: '#fff' } : undefined}
              onClick={remove}
            >
              <Trash2 size={20} className={armDelete ? undefined : 'exp'} />
            </button>
          ) : (
            <button className="icon-btn" aria-label="Scan receipt" onClick={() => fileRef.current?.click()}>
              {scan === 'failed' ? <TriangleAlert size={22} className="exp" /> : <ScanLine size={22} style={{ color: 'var(--accent)' }} />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        </div>

        <div className={`amount num ${!input ? 'empty' : type === 'income' ? 'inc' : 'exp'} ${hints.has('amount') ? 'hint' : ''}`} aria-live="polite">
          {input ? `${symbol}${input}` : money(0, symbol)}
        </div>

        <div className="meta">
          {merchant && (
            <span className={`chip ${hints.has('merchant') ? 'hint' : ''}`}><Store size={16} />{merchant}</span>
          )}
          <label className={`chip ${hints.has('date') ? 'hint' : ''}`} aria-label="Date">
            <CalendarDays size={16} />{dateText}
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <button className="chip" aria-label="Note" aria-pressed={showNote} onClick={() => setShowNote((s) => !s)}>
            <PenLine size={16} />
          </button>
        </div>

        {showNote && (
          <input className="note-input" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" autoFocus maxLength={80} />
        )}

        <div className="cats" role="group" aria-label="Category">
          {CATEGORIES[type].map((c) => (
            <button key={c.id} aria-label={c.label} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              <span className="cat" style={{ background: c.color }}><c.icon size={24} /></span>
            </button>
          ))}
        </div>

        <div className="keys">
          {['7', '8', '9'].map((k) => <Key key={k} k={k} onPress={press} />)}
          <button className="key del" aria-label="Backspace" onClick={() => press('del')}><Delete size={24} /></button>
          {['4', '5', '6'].map((k) => <Key key={k} k={k} onPress={press} />)}
          <button className="key ok" aria-label="Save" disabled={!canSave} onClick={save}><Check size={30} strokeWidth={2.6} /></button>
          {['1', '2', '3', '.', '0', '00'].map((k) => <Key key={k} k={k} onPress={press} />)}
        </div>

        {scan === 'busy' && (
          <div className="busy" aria-label="Reading receipt"><LoaderCircle size={44} className="spin" /></div>
        )}
      </div>
    </div>
  )
}

function Key({ k, onPress }: { k: string; onPress: (k: string) => void }) {
  return <button className="key" onClick={() => onPress(k)}>{k}</button>
}
