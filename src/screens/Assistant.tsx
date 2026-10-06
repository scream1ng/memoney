import { ArrowRight, ArrowUp, Check, ChevronRight, CircleCheck, LoaderCircle, Mic, NotebookPen, TriangleAlert, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { Amount, CatIcon } from '../components/ui'
import { useDragClose } from '../hooks/useDragClose'
import { useRecorder } from '../hooks/useRecorder'
import { ask } from '../lib/assistant'
import { clearCapture, peekCapture } from '../lib/capture'
import { category } from '../lib/categories'
import { dayLabel, money, monthKey, toDateKey, uid, weekStart } from '../lib/format'
import { noteParts, notesRepo } from '../lib/notes'
import { currencyAtom, dayAtom, monthAtom, periodAtom, repo, useAtom, weekAtom } from '../lib/store'
import type { AssistantReply, Page, Proposal, Tx, Turn } from '../lib/types'

type Entry = { role: 'user'; text: string; voice: boolean } | { role: 'assistant'; reply: AssistantReply }
type Go = (path: string, state?: object) => void

const EXAMPLES = ['“Coffee 60”', '“Note: call the plumber”', '“What did I spend yesterday?”']
const PATHS: Record<Page, string> = { home: '/', stats: '/stats', notes: '/notes', settings: '/settings' }
const PAGE_LABEL: Record<Page, string> = { home: 'Home', stats: 'Stats', notes: 'Notes', settings: 'Settings' }

/** Voice from the + menu: listens, then answers questions and proposes changes that only happen after a tap. */
export function Assistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const bg = (location.state as { bg?: Location } | null)?.bg
  const [symbol] = useAtom(currencyAtom)
  const [capture] = useState(() => { const c = peekCapture(); return c?.kind === 'audio' ? c : undefined })
  const [entries, setEntries] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const request = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const threadRef = useRef<HTMLDivElement>(null)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    if (bg) navigate(-1)
    else navigate('/', { replace: true })
  }
  // leaving for another sheet or page replaces this one, so Back lands on the page underneath
  const go: Go = (path, state) => {
    closing.current = true
    const sheet = /^\/(add|tx\/|notes\/)/.test(path)
    navigate(path, { replace: true, state: { ...state, ...(sheet && bg ? { bg } : {}) } })
  }
  const drag = useDragClose(close, busy)
  const rec = useRecorder((audio) => void send(audio), (message) => setError(message))

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearCapture()
      request.current?.abort()
    }
  }, [])
  // deferred a tick so StrictMode's dev remount doesn't start it twice
  useEffect(() => {
    if (!capture) return
    const t = setTimeout(() => void rec.start(capture.stream))
    return () => clearTimeout(t)
  }, [capture]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [entries, busy])

  function goTo(action: Extract<Proposal, { kind: 'navigate' }>) {
    if (action.date && (action.page === 'home' || action.page === 'stats')) {
      const period = action.period ?? periodAtom.get()
      periodAtom.set(period)
      if (period === 'day') dayAtom.set(action.date)
      else if (period === 'week') weekAtom.set(weekStart(action.date))
      else monthAtom.set(monthKey(action.date))
    }
    go(PATHS[action.page])
  }

  async function send(input: Blob | string) {
    if (busy) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const history: Turn[] = entriesRef.current.map((e) => e.role === 'user' ? { role: 'user', text: e.text } : { role: 'assistant', text: e.reply.reply })
    setError('')
    setBusy(true)
    const asked = typeof input === 'string' ? { role: 'user' as const, text: input, voice: false } : undefined
    if (asked) setEntries((list) => [...list, asked])
    try {
      const reply = await ask(input, history, symbol, controller.signal)
      if (!alive.current || controller.signal.aborted) return
      setEntries((list) => [...list, ...(typeof input === 'string' ? [] : [{ role: 'user' as const, text: reply.heard ?? '', voice: true }]), { role: 'assistant', reply }])
      const now = reply.actions.find((a): a is Extract<Proposal, { kind: 'navigate' }> => a.kind === 'navigate' && a.now)
      if (now) goTo(now)
    } catch (err) {
      if (alive.current && !controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Couldn’t get an answer. Try again.')
        // hand the typed question back instead of making them retype it
        if (asked) {
          setEntries((list) => list.filter((e) => e !== asked))
          setText(asked.text)
        }
      }
    } finally {
      if (alive.current && request.current === controller) setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const said = text.trim()
    if (!said || busy) return
    setText('')
    void send(said)
  }

  // the first recording gets the full-screen listening view; follow-ups stay in the thread
  if (!entries.length && (rec.phase !== 'idle' || (busy && !!capture))) {
    const status = busy ? 'Working it out…' : rec.phase === 'requesting' ? 'Connecting microphone' : 'Listening'
    return (
      <Modal onDismiss={close} className={`voice-mode ${busy ? 'busy' : rec.phase}`} aria-label="Voice">
        <div className="vm-title">Voice</div>
        <div className="vm-center">
          <div className="orb-wrap" aria-hidden><div ref={rec.orbRef} className="orb" /></div>
          <div className="vm-status" aria-live="polite">{rec.phase === 'rec' && <span className="voice-dot" />}{status}</div>
          {!busy && <>
            <p className="vm-guide">Add an expense or a note,<br />or ask anything</p>
            <div className="vm-examples" aria-label="Examples">{EXAMPLES.map((x) => <span key={x}>{x}</span>)}</div>
          </>}
        </div>
        <div className="vm-bar">
          <button className="vm-round finish" aria-label="Finish recording" disabled={rec.phase !== 'rec'} onClick={rec.stop}><Check size={26} strokeWidth={2.4} /></button>
          <button className="vm-round cancel" aria-label="Cancel voice" onClick={close}><X size={26} strokeWidth={2.4} /></button>
        </div>
      </Modal>
    )
  }

  const listening = rec.phase !== 'idle'
  return (
    <Modal onDismiss={close} busy={busy} className="glass sheet ask-sheet" aria-label="Voice" style={drag.style}>
      <div className="handle" {...drag.handlers}>
        <div className="grab" aria-hidden />
        <div className="row between">
          <span className="ask-title"><Mic size={18} />Voice</span>
          <button className="icon-btn" aria-label="Close voice" onClick={close}><X size={20} /></button>
        </div>
      </div>
      <div className="ask-thread" ref={threadRef}>
        {!entries.length && !busy && (
          <div className="ask-ai">
            Add an expense or a note, or ask anything.
            <div className="vm-examples ask-examples">{EXAMPLES.map((x) => <span key={x}>{x}</span>)}</div>
          </div>
        )}
        {entries.map((e, i) => e.role === 'user'
          ? <div key={i} className="ask-you">{e.voice && <span className="ask-via"><Mic size={12} /></span>}{e.text || '…'}</div>
          : <Answer key={i} reply={e.reply} symbol={symbol} go={go} goTo={goTo} />)}
        {busy && <div className="ask-ai ask-wait" role="status"><LoaderCircle size={18} className="spin accent" />Working it out…</div>}
        {error && <div className="warn" role="alert"><TriangleAlert size={18} />{error}</div>}
      </div>
      <form className="ask-compose" onSubmit={submit}>
        <input className="ask-input" aria-label="Ask or tell MeMoney" placeholder={listening ? 'Listening…' : entries.length ? 'Ask a follow-up…' : 'Type or tap the mic'}
          value={text} maxLength={2000} disabled={listening} onChange={(e) => setText(e.target.value)} />
        {text.trim() ? (
          <button className="round ask-mic" type="submit" aria-label="Send" disabled={busy}><ArrowUp size={24} /></button>
        ) : (
          <button className={`round ask-mic${listening ? ' on' : ''}`} type="button" aria-label={listening ? 'Stop recording' : 'Talk'} disabled={busy}
            onClick={() => (listening ? rec.stop() : void rec.start())}>
            {listening ? <Check size={24} /> : <Mic size={24} />}
          </button>
        )}
      </form>
    </Modal>
  )
}

function Answer({ reply, symbol, go, goTo }: { reply: AssistantReply; symbol: string; go: Go; goTo: (a: Extract<Proposal, { kind: 'navigate' }>) => void }) {
  const [chosen, setChosen] = useState<number>()
  const links = reply.actions.filter((a): a is Extract<Proposal, { kind: 'navigate' }> => a.kind === 'navigate' && !a.now)
  const writes = reply.actions.filter((a) => a.kind !== 'navigate')
  return (
    <>
      {reply.reply && <div className="ask-ai">{reply.reply}</div>}
      {reply.summary && (
        <div className="card ask-sum">
          <span className="stats-summary-kicker">{reply.summary.title.toUpperCase()}</span>
          <span className="num ask-total">{money(reply.summary.expense, symbol)}</span>
          {reply.summary.expense > 0 && <div className="stats-income-bar">
            {Object.entries(reply.summary.byCategory).map(([cat, amount]) => <span key={cat} style={{ width: `${amount / reply.summary!.expense * 100}%`, background: category(cat).color }} />)}
          </div>}
        </div>
      )}
      {!!reply.transactions.length && (
        <div className="card list ask-list">
          {reply.transactions.map((t) => (
            <button key={t.id} className="row tx" onClick={() => go(`/tx/${t.id}`)}>
              <CatIcon id={t.category} />
              <div className="grow">
                <div>{t.merchant || category(t.category).label}</div>
                <div className="sub">{[dayLabel(t.date), t.note].filter(Boolean).join(' · ')}</div>
              </div>
              <Amount tx={t} />
            </button>
          ))}
        </div>
      )}
      {!!reply.notes.length && (
        <div className="card list ask-list">
          {reply.notes.map((n) => {
            const [title, sub] = noteParts(n.text)
            return (
              <button key={n.id} className="row tx" onClick={() => go(`/notes/${n.id}`)}>
                <span className="nt-tile"><NotebookPen size={20} /></span>
                <div className="grow"><div className="nt-title">{title}</div>{sub && <div className="sub">{sub}</div>}</div>
                <span className="nt-time">{dayLabel(toDateKey(new Date(n.createdAt)))}</span>
              </button>
            )
          })}
        </div>
      )}
      {reply.choose && chosen === undefined ? (
        <div className="ask-choices">
          {writes.map((a, i) => (
            <button key={i} className="card ask-choice" onClick={() => setChosen(i)}>
              {a.kind === 'add_tx' && a.tx.category ? <CatIcon id={a.tx.category} /> : <span className="nt-tile"><NotebookPen size={20} /></span>}
              <span className="value">
                <strong>{a.kind === 'add_tx' ? a.tx.type === 'income' ? 'Income' : 'Expense' : 'Note'}</strong>
                <small>{a.kind === 'add_tx' ? `${money(a.tx.amount, symbol)} · ${dayLabel(a.tx.date)}` : a.kind === 'add_note' ? `“${noteParts(a.text)[0]}”` : ''}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      ) : (
        writes.map((a, i) => (chosen === undefined || chosen === i) && <ActionCard key={i} action={a} symbol={symbol} go={go} />)
      )}
      {links.map((a, i) => (
        <button key={i} className="ask-link" onClick={() => goTo(a)}>Open {PAGE_LABEL[a.page]} <ArrowRight size={18} /></button>
      ))}
    </>
  )
}

type Write = Exclude<Proposal, { kind: 'navigate' }>

const KIND_LABEL: Record<Write['kind'], string> = {
  add_tx: 'ADD EXPENSE', edit_tx: 'EDIT ENTRY', delete_tx: 'DELETE ENTRY', add_note: 'ADD NOTE', edit_note: 'EDIT NOTE', delete_note: 'DELETE NOTE',
}

/** A proposed change. Nothing is saved until the tap; Undo reverses it through the same endpoints. */
function ActionCard({ action, symbol, go }: { action: Write; symbol: string; go: Go }) {
  // one id per card, so a retry updates the same row instead of adding a second one
  const [id] = useState(uid)
  const [createdAt] = useState(Date.now)
  const [state, setState] = useState<'open' | 'saving' | 'done' | 'undoing' | 'skipped' | 'undone'>('open')
  const [error, setError] = useState('')
  const undo = useRef<() => Promise<void>>(undefined)

  if (state === 'skipped') return null
  const danger = action.kind === 'delete_tx' || action.kind === 'delete_note'
  const label = action.kind === 'add_tx' && action.tx.type === 'income' ? 'ADD INCOME' : KIND_LABEL[action.kind]

  async function confirm() {
    setState('saving')
    setError('')
    try {
      const a = action
      if (a.kind === 'add_tx') {
        const tx: Tx = { id, type: a.tx.type, amount: a.tx.amount, category: a.tx.category!, date: a.tx.date, note: a.tx.note, merchant: a.tx.merchant, createdAt }
        await repo.save(tx)
        undo.current = () => repo.remove(id)
      } else if (a.kind === 'edit_tx') {
        await repo.save(a.after)
        undo.current = () => repo.save(a.before)
      } else if (a.kind === 'delete_tx') {
        await repo.remove(a.tx.id)
        // the receipt photo is deleted with the entry, so it can't come back
        undo.current = () => repo.save({ ...a.tx, photoAt: undefined })
      } else if (a.kind === 'add_note') {
        await notesRepo.save({ id, text: a.text, createdAt, updatedAt: createdAt })
        undo.current = () => notesRepo.remove(id)
      } else if (a.kind === 'edit_note') {
        await notesRepo.save({ ...a.before, text: a.text, updatedAt: Date.now() })
        undo.current = () => notesRepo.save(a.before)
      } else {
        await notesRepo.remove(a.note.id)
        undo.current = () => notesRepo.save(a.note)
      }
      setState('done')
    } catch {
      setError('Couldn’t save that. Try again.')
      setState('open')
    }
  }
  async function revert() {
    setState('undoing')
    try {
      await undo.current?.()
      setState('undone')
    } catch {
      setError('Couldn’t undo that.')
      setState('done')
    }
  }

  if (state === 'done' || state === 'undoing' || state === 'undone') {
    const doneText = state === 'undone' ? 'Undone' : danger ? 'Deleted' : action.kind === 'add_note' ? 'Note added' : action.kind === 'add_tx' ? 'Saved' : 'Updated'
    return (
      <div className="card ask-done" role="status">
        <CircleCheck size={22} />
        <span className="grow">{doneText}{error && ` · ${error}`}</span>
        {state !== 'undone' && <button className="ask-undo" disabled={state === 'undoing'} onClick={() => void revert()}>Undo</button>}
      </div>
    )
  }

  const saving = state === 'saving'
  // a guess without a category can't be saved as is; review it in the Add sheet
  const needsEdit = action.kind === 'add_tx' && !action.tx.category
  const edit = action.kind === 'add_tx' ? () => go('/add', { draft: action.tx })
    : action.kind === 'add_note' ? () => go('/notes/new', { draft: action.text }) : undefined
  const verb = danger ? 'Delete' : action.kind === 'add_tx' ? needsEdit ? 'Review' : 'Save entry' : action.kind === 'add_note' ? 'Add note' : 'Save changes'
  return (
    <div className={`card ask-act${danger ? ' danger' : ''}`}>
      <div className="ask-act-head"><span className="hint-mark" />{label}</div>
      <div className="ask-act-body"><ActionBody action={action} symbol={symbol} /></div>
      {error && <div className="warn" role="alert"><TriangleAlert size={18} />{error}</div>}
      <div className="ask-act-bar">
        {edit ? <button className="ask-btn" disabled={saving} onClick={edit}>Edit</button>
          : <button className="ask-btn" disabled={saving} onClick={() => setState('skipped')}>Cancel</button>}
        <button className={`ask-btn ${danger ? 'destroy' : 'primary'}`} disabled={saving} onClick={() => void (needsEdit ? edit?.() : confirm())}>
          {saving ? 'Saving…' : verb}
        </button>
      </div>
    </div>
  )
}

function ActionBody({ action, symbol }: { action: Write; symbol: string }) {
  if (action.kind === 'add_note' || action.kind === 'edit_note' || action.kind === 'delete_note') {
    const text = action.kind === 'delete_note' ? action.note.text : action.text
    const [title, sub] = noteParts(text)
    const was = action.kind === 'edit_note' ? `Was “${noteParts(action.before.text)[0]}”` : undefined
    return <>
      <span className="nt-tile"><NotebookPen size={20} /></span>
      <div className="value"><strong className={action.kind === 'delete_note' ? undefined : 'ask-guess'}>{title}</strong><small>{was ?? (sub || 'Notes')}</small></div>
    </>
  }
  const tx = action.kind === 'add_tx' ? action.tx : action.kind === 'edit_tx' ? action.after : action.tx
  const name = tx.merchant || (tx.category ? category(tx.category).label : 'Choose category')
  const before = action.kind === 'edit_tx' ? action.before : undefined
  const was = before && [before.amount !== tx.amount && money(before.amount, symbol), before.date !== tx.date && dayLabel(before.date),
    before.category !== tx.category && category(before.category).label].filter(Boolean).join(', ')
  return <>
    {tx.category ? <CatIcon id={tx.category} /> : <span className="nt-tile" />}
    <div className="value">
      <strong>{name}</strong>
      <small>{was ? `Was ${was}` : [tx.category && category(tx.category).label, dayLabel(tx.date)].filter(Boolean).join(' · ')}</small>
    </div>
    <span className="ask-amt"><Amount tx={{ type: tx.type ?? 'expense', amount: tx.amount ?? 0 }} /></span>
  </>
}
