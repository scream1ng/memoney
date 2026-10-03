import { Check, ImageOff, LoaderCircle, Plus, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { money, parseAmount } from '../lib/format'
import { currencyAtom, repo, useAtom } from '../lib/store'
import { EntryForm } from './EntryForm'
import { AddReceipts } from './Overview'
import { dismissSkipped, hideReview, pending, update, useSkipped, useUploads, type Draft, type Upload as Item } from './uploads'

const needsCheck = (u: Item) => u.status === 'check' || u.status === 'failed'
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
// a dialog on top (the entry panel, a category picker) handles its own keys
const covered = () => !!document.querySelector('dialog[open]')

function statusText(u: Item, symbol: string) {
  const what = [u.draft.merchant, u.draft.input && money(parseAmount(u.draft.input), symbol)].filter(Boolean).join(' ')
  switch (u.status) {
    case 'waiting': return u.error ?? 'Waiting…'
    case 'reading': return 'Reading…'
    case 'check': return `Check${what && ` · ${what}`}`
    case 'failed': return 'Couldn’t read · type it in'
    case 'saved': return `Saved${what && ` · ${what}`}`
    case 'skipped': return 'Skipped'
    case 'broken': return 'Can’t open this file'
  }
}

/** Full-window layer for checking added receipts one by one. Opens when files are added; nothing saves without Save. */
export function Review() {
  const items = useUploads()
  const skipped = useSkipped()
  const [symbol] = useAtom(currencyAtom)
  const [picked, setPicked] = useState<string>()
  const layer = useRef<HTMLDivElement>(null)
  // the picked receipt, else the first one waiting for a check, else the one being read
  const current = items.find((u) => u.id === picked) ?? items.find(needsCheck) ?? items.find(pending) ?? items[items.length - 1]
  const saved = items.filter((u) => u.status === 'saved').length

  /** after Save or Skip: the next receipt that needs a check, looking forward first */
  const advance = (from: Item) => {
    const at = items.indexOf(from)
    const next = [...items.slice(at + 1), ...items.slice(0, at)].find(needsCheck)
    setPicked(next?.id ?? items.slice(at + 1).find(pending)?.id)
  }
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    layer.current?.focus()
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [])
  // Esc closes; ← / → step through the list unless the cursor is in a field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (covered() || e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === 'Escape') { e.preventDefault(); hideReview(); return }
      if ((e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || typing(e.target) || !current) return
      const next = items[items.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1)]
      if (next) { e.preventDefault(); setPicked(next.id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, current])

  return (
    <div ref={layer} className="wd-layer" role="dialog" aria-modal="true" aria-label="Review receipts" tabIndex={-1}>
      <header className="wd-top">
        <h1>Review receipts</h1>
        <span className="muted wd-count" aria-live="polite">{saved} of {items.length} saved</span>
        <AddReceipts className="wd-btn"><Plus size={20} />Add more</AddReceipts>
        <button className="icon-btn" aria-label="Close review" onClick={hideReview}><X size={20} /></button>
      </header>
      {!!skipped && <div className="warn wd-notice" role="alert"><TriangleAlert size={18} />
        {skipped === 1 ? '1 file wasn’t an image and was left out.' : `${skipped} files weren’t images and were left out.`}
        <button className="wd-link" onClick={dismissSkipped}>OK</button></div>}
      {current && (
        <div className="wd-body wd-rv">
          <section className="card wd-queue" aria-label="Receipts">
            {items.map((u) => (
              <button key={u.id} className={`wd-qi${u === current ? ' on' : ''}`} aria-current={u === current} onClick={() => setPicked(u.id)}>
                {u.url ? <img src={u.url} alt="" /> : <span className="wd-qi-ph">{u.status === 'broken' ? <ImageOff size={18} /> : <LoaderCircle size={18} className="spin" />}</span>}
                <span className="wd-qi-text">
                  <span className="t">{u.name}</span>
                  <span className={`s ${u.status}`}>{(u.status === 'reading' || u.status === 'waiting') && <LoaderCircle size={12} className="spin" />}{statusText(u, symbol)}</span>
                </span>
              </button>
            ))}
          </section>
          <section className="card wd-photo">
            {current.url ? <img src={current.url} alt={`Receipt ${current.name}`} /> : current.status === 'broken' ? <ImageOff size={40} className="muted" /> : <LoaderCircle size={36} className="spin accent" />}
          </section>
          <section className="wd-rv-form">
            <ReceiptCheck key={current.id} item={current} onDone={() => advance(current)} />
          </section>
        </div>
      )}
    </div>
  )
}

/** The form for one receipt. */
function ReceiptCheck({ item, onDone }: { item: Item; onDone: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const d = item.draft
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const writing = useRef(false)
  const alive = useRef(true)
  const amountRef = useRef<HTMLInputElement>(null)
  const amount = parseAmount(d.input)
  const open = item.status === 'check' || item.status === 'failed' || item.status === 'skipped'
  const canSave = open && amount > 0 && !!d.cat && !saving

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  // a receipt we couldn't read starts with the cursor in the amount
  useEffect(() => { if (item.status === 'failed') amountRef.current?.focus() }, [item.status])

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canSave || writing.current) return
    writing.current = true
    setSaving(true)
    setError('')
    try {
      await repo.save({
        id: item.txId, type: d.type, amount, category: d.cat!, date: d.date, note: d.note.trim() || undefined,
        merchant: d.merchant.trim() || undefined, createdAt: Date.now(),
      }, item.jpeg)
      update(item.id, { status: 'saved' })
      onDone()
    } catch {
      if (alive.current) setError('Could not confirm saving this entry. Your changes are still here. Try again.')
    } finally {
      writing.current = false
      if (alive.current) setSaving(false)
    }
  }
  // Enter saves when nothing in particular has focus (fields submit the form themselves)
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || covered() || !(e.target === document.body || (e.target instanceof HTMLElement && e.target.classList.contains('wd-layer')))) return
      e.preventDefault()
      void saveRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (item.status === 'waiting' || item.status === 'reading') {
    return <div className="ai-panel" aria-live="polite">
      <LoaderCircle size={36} className="spin accent" />
      <div className="lbl">{item.status === 'reading' ? 'Reading receipt…' : item.error ?? 'Waiting to be read…'}</div>
      <div className="sub">You can check the details before saving.</div>
    </div>
  }
  if (item.status === 'broken') {
    return <>
      <div className="warn" role="alert"><TriangleAlert size={18} />{item.error}</div>
      <p className="muted wd-kbd">HEIC photos from an iPhone can’t be opened here. Export them as JPG, or add this one from the phone app.</p>
    </>
  }
  if (item.status === 'saved') {
    return <div className="ai-panel">
      <Check size={36} className="inc" />
      <div className="lbl">Saved</div>
      <button className="wd-link" onClick={() => navigate(`/tx/${item.txId}`, { state: { bg: location } })}>Edit entry</button>
    </div>
  }

  const dot = <span className="hint-mark" aria-label="Guessed" />
  return (
    <form className="wd-rv-check" onSubmit={(e) => void save(e)}>
      <div className="review-source">
        From your receipt{d.merchant && ` · ${d.merchant}`}
        {!!d.hints.length && <> · <span className="wd-guess">{dot} = our guess</span></>}
      </div>
      {item.status === 'failed' && <div className="warn" role="alert"><TriangleAlert size={18} />{item.error || 'Couldn’t read the receipt. Type the amount instead.'}</div>}
      {error && <div className="warn" role="alert">{error}</div>}
      <EntryForm value={d} hints={d.hints} disabled={saving} amountRef={amountRef}
        onChange={(patch, field) => update(item.id, { draft: { ...d, ...patch, hints: d.hints.filter((h) => h !== field) } as Draft })} />
      <footer className="wd-foot">
        <span className="wd-kbd grow"><kbd>Enter</kbd> save · <kbd>→</kbd> next</span>
        {item.status !== 'skipped' && <button type="button" className="wd-btn" disabled={saving} onClick={() => { update(item.id, { status: 'skipped' }); onDone() }}>Skip</button>}
        <button type="submit" className="wd-btn primary" disabled={!canSave}>{saving ? 'Saving…' : 'Save entry'}</button>
      </footer>
    </form>
  )
}
