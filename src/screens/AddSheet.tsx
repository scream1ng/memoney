import { CalendarDays, Camera, Delete, Ellipsis, LoaderCircle, Mic, PenLine, Square, Store, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { TypeToggle } from '../components/ui'
import { CATEGORIES, category } from '../lib/categories'
import { amountToInput, dayLabel, money, parseAmount, today, uid } from '../lib/format'
import { parse, type Guess } from '../lib/parse'
import { currencyAtom, repo, useAtom, useTransactions } from '../lib/store'
import type { TxType } from '../lib/types'

type Field = 'type' | 'amount' | 'date' | 'cat' | 'note' | 'merchant'
type Phase = 'idle' | 'rec' | 'voice' | 'busy' | 'failed'

const MAX_LISTEN_MS = 30_000

type BrowserRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

/** "1250.5" → "1,250.5"; keeps a trailing "." while typing */
function group(input: string): string {
  const [whole, dec] = input.split('.')
  const g = Number(whole || '0').toLocaleString('en-US')
  return dec === undefined ? g : `${g}.${dec}`
}

export function AddSheet() {
  const { id } = useParams()
  const all = useTransactions()
  const existing = all.find((t) => t.id === id)
  const navigate = useNavigate()
  const location = useLocation()
  const [symbol] = useAtom(currencyAtom)

  const [type, setType] = useState<TxType>(existing?.type ?? 'expense')
  const [input, setInput] = useState(existing ? amountToInput(existing.amount) : '')
  const [cat, setCat] = useState<string | undefined>(existing?.category)
  const [date, setDate] = useState(existing?.date ?? today())
  const [note, setNote] = useState(existing?.note ?? '')
  const [merchant, setMerchant] = useState(existing?.merchant ?? '')
  const [showNote, setShowNote] = useState(false)
  const [armDelete, setArmDelete] = useState(false)
  const [hints, setHints] = useState<Set<Field>>(new Set())
  // a category picked from More takes the 4th slot for this session
  const [extra, setExtra] = useState<string | undefined>(existing?.category)
  const [sub, setSub] = useState<'cats' | 'photo'>()
  const [phase, setPhase] = useState<Phase>('idle')
  const [spoken, setSpoken] = useState('')
  const [source, setSource] = useState<'audio' | 'image'>('image')
  const [heard, setHeard] = useState('')
  const [parseError, setParseError] = useState('')
  // kept in memory only until attachment storage is decided (issue #1)
  const [photo, setPhoto] = useState<Blob>()
  const fileRef = useRef<HTMLInputElement>(null)
  const recRef = useRef<BrowserRecognition | null>(null)
  const voiceInputRef = useRef<HTMLTextAreaElement>(null)
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parseReq = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const amountRef = useRef<HTMLDivElement>(null)

  // history nav is async, so the sheet stays up long enough to take a second tap
  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    if (location.state?.bg) navigate(-1)
    else navigate('/', { replace: true })
  }
  const drag = useDragClose(close)
  const amount = parseAmount(input)
  const working = phase === 'rec' || phase === 'voice' || phase === 'busy'
  const canSave = amount > 0 && !!cat && !working
  const unhint = (f: Field) => setHints((h) => (h.has(f) ? new Set([...h].filter((x) => x !== f)) : h))

  const top = useMemo(() => {
    const count = new Map<string, number>()
    for (const t of all) if (t.type === type) count.set(t.category, (count.get(t.category) ?? 0) + 1)
    return [...CATEGORIES[type]].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0)).slice(0, 4)
  }, [all, type])
  const shown = extra && !top.some((c) => c.id === extra) && CATEGORIES[type].some((c) => c.id === extra)
    ? [...top.slice(0, 3), category(extra)]
    : top

  const photoUrl = useMemo(() => photo && URL.createObjectURL(photo), [photo])
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  // stop the mic if the sheet closes mid-recording
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      parseReq.current?.abort()
      recRef.current?.abort()
      if (voiceTimer.current) clearTimeout(voiceTimer.current)
    }
  }, [])

  useEffect(() => { if (phase === 'voice') voiceInputRef.current?.focus() }, [phase])

  const shownAmount = input ? `${symbol}${group(input)}` : money(0, symbol)
  // shrink to fit one line: 46px down to 26px
  useLayoutEffect(() => {
    const el = amountRef.current
    if (!el) return
    let size = 46
    el.style.fontSize = `${size}px`
    while (el.scrollWidth > el.clientWidth && size > 26) {
      size -= 2
      el.style.fontSize = `${size}px`
    }
  }, [shownAmount, hints])

  function press(k: string) {
    unhint('amount')
    if (phase === 'failed') setPhase('idle')
    setInput((cur) => {
      if (k === 'del') return cur.slice(0, -1)
      if (k === '.') return cur.includes('.') ? cur : (cur || '0') + '.'
      if (!cur || cur === '0') return k
      const next = cur + k
      const [whole, dec] = next.split('.')
      if (whole.length > 9 || (dec && dec.length > 2)) return cur
      return next
    })
  }

  function switchType(t: TxType) {
    setType(t)
    unhint('type')
    if (!CATEGORIES[t].some((c) => c.id === cat)) setCat(undefined)
  }

  function pick(c: string) {
    setCat(c)
    setExtra(c)
    unhint('cat')
    setSub(undefined)
  }

  function apply(g: Guess): boolean {
    const found = new Set<Field>()
    const t = g.type === 'income' || g.type === 'expense' ? g.type : type
    if (t !== type) { setType(t); found.add('type') }
    if (g.amount && Number.isSafeInteger(g.amount) && g.amount > 0) { setInput(amountToInput(g.amount)); found.add('amount') }
    if (g.date && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) { setDate(g.date); found.add('date') }
    if (g.category && CATEGORIES[t].some((c) => c.id === g.category)) {
      setCat(g.category)
      setExtra(g.category)
      found.add('cat')
    } else if (!CATEGORIES[t].some((c) => c.id === cat)) setCat(undefined)
    if (g.note) { setNote(g.note.slice(0, 80)); found.add('note') }
    if (g.merchant) { setMerchant(g.merchant.slice(0, 80)); found.add('merchant') }
    setHeard(g.heard ?? '')
    setHints(found)
    return found.has('amount') || found.has('cat') || found.has('date') || found.has('merchant')
  }

  async function run(input: Blob | string, kind: 'audio' | 'image') {
    parseReq.current?.abort()
    const request = new AbortController()
    parseReq.current = request
    setParseError('')
    setSource(kind)
    setPhase('busy')
    try {
      const guess = await parse(input, kind, symbol, request.signal)
      if (alive.current && !request.signal.aborted) {
        const applied = apply(guess)
        if (!applied && kind === 'audio') setParseError('No transaction found. Correct the text and try again.')
        setPhase(applied ? 'idle' : kind === 'audio' ? 'voice' : 'failed')
      }
    } catch (err) {
      if (alive.current && !request.signal.aborted) {
        setParseError(err instanceof Error ? err.message : '')
        setPhase(kind === 'audio' ? 'voice' : 'failed')
      }
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhoto(file)
    setSub(undefined)
    void run(file, 'image')
  }

  function toggleMic() {
    if (phase === 'rec') return recRef.current?.stop()
    setParseError('')
    setSource('audio')
    setSpoken('')
    setHeard('')
    const browser = window as Window & {
      SpeechRecognition?: new () => BrowserRecognition
      webkitSpeechRecognition?: new () => BrowserRecognition
    }
    const SpeechRecognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
    if (!SpeechRecognition) return setPhase('voice')
    const recognition = new SpeechRecognition()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    const done = () => {
      if (voiceTimer.current) clearTimeout(voiceTimer.current)
      voiceTimer.current = null
      recRef.current = null
    }
    recognition.onresult = (event) => {
      setSpoken(Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim())
    }
    recognition.onend = () => {
      if (recRef.current !== recognition) return
      done()
      if (alive.current) setPhase('voice')
    }
    recognition.onerror = () => {
      if (recRef.current !== recognition) return
      done()
      if (alive.current) {
        setParseError('Use your keyboard microphone or type your entry.')
        setPhase('voice')
      }
    }
    recRef.current = recognition
    try {
      recognition.start()
      voiceTimer.current = setTimeout(() => recognition.stop(), MAX_LISTEN_MS)
      setPhase('rec')
    } catch {
      done()
      setPhase('voice')
    }
  }

  function save() {
    if (!canSave || closing.current) return
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

  const h = (f: Field) => (hints.has(f) ? 'hint' : '')

  return (
    <div className="sheet-wrap" onClick={close}>
      <div
        className={`glass sheet ${sub ? 'behind' : ''}`}
        role="dialog" aria-modal="true" aria-label={existing ? 'Edit' : 'Add'}
        style={drag.style}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="handle" {...drag.handlers}>
          <div className="grab" aria-hidden />
          <div className="row between">
            <label className={`chip ${date !== today() ? 'date-off' : ''} ${h('date')}`} aria-label="Date">
              <CalendarDays size={16} />{dayLabel(date)}
              <input type="date" aria-label="Date" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); unhint('date') } }} />
            </label>
            <div className={hints.has('type') ? 'hint-seg' : undefined}><TypeToggle value={type} onChange={switchType} /></div>
          </div>
        </div>

        <div ref={amountRef} className={`amount num ${!input ? 'empty' : type === 'income' ? 'inc' : 'exp'} ${h('amount')}`} aria-live="polite">
          {shownAmount}
        </div>

        <div className="meta">
          {merchant && <span className={`chip ${h('merchant')}`} title={merchant}><Store size={16} /><span className="clip">{merchant}</span></span>}
          <button className={`chip ${note ? h('note') : 'ph'}`} aria-label="Note" aria-pressed={showNote} onClick={() => setShowNote((s) => !s)}>
            <PenLine size={16} /><span className="clip">{note || (cat ? category(cat).label : 'Note')}</span>
          </button>
        </div>

        {showNote && (
          <input className="note-input" value={note} onChange={(e) => { setNote(e.target.value); unhint('note') }} aria-label="Note" autoFocus maxLength={80} />
        )}
        {heard && <div className="heard">“{heard}”</div>}
        {!!hints.size && phase === 'idle' && <div className="review-hint">Review the highlighted details before saving.</div>}

        <div className="catrow" role="group" aria-label="Category">
          {shown.map((c) => (
            <button key={c.id} className={cat === c.id ? h('cat') : undefined} aria-pressed={cat === c.id} onClick={() => pick(c.id)}>
              <span className="cat" style={{ background: c.color }}><c.icon size={24} /></span>
              <span className="lbl">{c.label}</span>
            </button>
          ))}
          {CATEGORIES[type].length > 4 && (
            <button onClick={() => setSub('cats')}>
              <span className="cat more"><Ellipsis size={24} /></span>
              <span className="lbl">More</span>
            </button>
          )}
        </div>

        {phase === 'rec' ? (
          <div className="ai-panel voice-panel" aria-live="polite">
            <div className="voice-status"><span className="voice-dot" />Listening</div>
            <div className="lbl">Speak naturally</div>
            <div className="sub">Stops when you finish, or tap Stop.</div>
          </div>
        ) : phase === 'voice' ? (
          <div className="ai-panel voice-input-panel">
            <label className="lbl" htmlFor="voice-text">{spoken ? 'Review what you said' : 'Voice entry'}</label>
            <textarea id="voice-text" ref={voiceInputRef} value={spoken} onChange={(e) => { setSpoken(e.target.value); setParseError('') }}
              placeholder="Tap your keyboard mic to dictate, or type your entry" maxLength={8000} />
            <div className="sub">{parseError || 'Correct the text before Luna reads it.'}</div>
            <div className="voice-actions">
              <button className="pill" onClick={() => { setPhase('idle'); setSpoken(''); setParseError('') }}>Cancel</button>
              <button className="pill" disabled={!spoken.trim()} onClick={() => void run(spoken.trim(), 'audio')}>Read entry</button>
            </div>
          </div>
        ) : phase === 'busy' ? (
          <div className="ai-panel" aria-live="polite">
            {source === 'image' && photoUrl && <img className="thumb" src={photoUrl} alt="" />}
            <LoaderCircle size={36} className="spin accent" />
            <div className="lbl">{source === 'image' ? 'Reading receipt…' : 'Reading what you said…'}</div>
            <div className="sub">You can review the details before saving.</div>
          </div>
        ) : (
          <>
            {phase === 'failed' && (
              <div className="warn" role="alert">
                <TriangleAlert size={18} />
                {parseError || (source === 'image' ? 'Couldn’t read the receipt. Type the amount instead.' : 'Couldn’t understand that. Type it instead.')}
              </div>
            )}
            <div className={`keys ${phase === 'failed' ? 'compact' : ''}`}>
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map((k) => (
                <button key={k} className="key" onClick={() => press(k)}>{k}</button>
              ))}
              <button className="key del" aria-label="Backspace" onClick={() => press('del')}><Delete size={24} /></button>
            </div>
          </>
        )}

        <div className={`bottom ${existing ? 'editing' : ''}`}>
          <button className="round" aria-label={photo ? 'Receipt photo' : 'Add receipt photo'} disabled={working}
            onClick={() => (photo ? setSub('photo') : fileRef.current?.click())}>
            <Camera size={24} />{photo && <span className="dot" />}
          </button>
          <button className={`round ${phase === 'rec' ? 'voice-stop' : ''}`} aria-label={phase === 'rec' ? 'Stop listening' : 'Voice entry'}
            disabled={phase === 'busy'} onClick={toggleMic}>
            {phase === 'rec' ? <><Square size={14} fill="currentColor" />Stop</> : <Mic size={24} />}
          </button>
          {existing && (
            <button className={`round ${armDelete ? 'armed' : 'exp'}`} aria-label={armDelete ? 'Confirm delete' : 'Delete'} onClick={remove}>
              <Trash2 size={22} />
            </button>
          )}
          <button className="save" disabled={!canSave} onClick={save}>Save</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {sub === 'cats' && (
        <SubSheet label="Category" onClose={() => setSub(undefined)}>
          <div className="cats" role="group" aria-label="Category">
            {CATEGORIES[type].map((c) => (
              <button key={c.id} aria-pressed={cat === c.id} onClick={() => pick(c.id)}>
                <span className="cat" style={{ background: c.color }}><c.icon size={24} /></span>
                <span className="lbl">{c.label}</span>
              </button>
            ))}
          </div>
        </SubSheet>
      )}
      {sub === 'photo' && photoUrl && (
        <SubSheet label="Receipt" onClose={() => setSub(undefined)}>
          <img className="photo" src={photoUrl} alt="Receipt" />
          <div className="row">
            <button className="pill grow" onClick={() => fileRef.current?.click()}>Replace</button>
            <button className="pill grow exp" onClick={() => { setPhoto(undefined); setSub(undefined) }}>Remove</button>
          </div>
        </SubSheet>
      )}
    </div>
  )
}

/** A second sheet stacked on top of the Add sheet (iOS-style). */
function SubSheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const drag = useDragClose(onClose)
  return (
    <div className="sheet-wrap sub" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="glass sheet" role="dialog" aria-modal="true" aria-label={label} style={drag.style} onClick={(e) => e.stopPropagation()}>
        <div className="handle" {...drag.handlers}>
          <div className="grab" aria-hidden />
          <h2 className="sheet-title">{label}</h2>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Drag the sheet's top area down past 100px to close. */
function useDragClose(onClose: () => void) {
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  const last = useRef(0) // read on pointerup; state can lag a fast flick by a render
  const move = (y: number) => {
    last.current = y
    setDy(y)
  }
  const end = () => {
    if (start.current == null) return
    start.current = null
    if (last.current > 100) onClose()
    else move(0)
  }
  return {
    style: dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined,
    handlers: {
      onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        if ((e.target as HTMLElement).closest('button, input, label')) return
        start.current = e.clientY
        e.currentTarget.setPointerCapture(e.pointerId)
      },
      onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        if (start.current != null) move(Math.max(0, e.clientY - start.current))
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  }
}
