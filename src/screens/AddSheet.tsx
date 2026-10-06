import { CalendarDays, Camera, Check, ChevronRight, Delete, Ellipsis, LoaderCircle, NotebookPen, Trash2, TriangleAlert, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDragClose } from '../hooks/useDragClose'
import { Modal } from '../components/Modal'
import { TypeToggle } from '../components/ui'
import { clearCapture, peekCapture, type Capture } from '../lib/capture'
import { ACTIVE_CATEGORIES, CATEGORIES, categories, category, categoryRepo, useCustomCategories } from '../lib/categories'
import { toJpeg } from '../lib/image'
import { amountToInput, dayLabel, money, parseAmount, today, uid } from '../lib/format'
import { parse, type Guess } from '../lib/parse'
import { currencyAtom, repo, useAtom, useTransactions } from '../lib/store'
import type { TxType } from '../lib/types'

type Field = 'type' | 'amount' | 'date' | 'cat' | 'note' | 'merchant'
type Phase = 'idle' | 'requesting' | 'rec' | 'busy' | 'failed'

const MAX_REC_MS = 30_000
const SILENCE_MS = 1_000
const NO_SPEECH_MS = 8_000

/** "1250.5" → "1,250.5"; keeps a trailing "." while typing */
function group(input: string): string {
  const [whole, dec] = input.split('.')
  const g = Number(whole || '0').toLocaleString('en-US')
  return dec === undefined ? g : `${g}.${dec}`
}

export function AddSheet() {
  const { id } = useParams()
  const all = useTransactions()
  // the fields start from the transaction, so wait until the list has loaded
  if (id && !all.some((t) => t.id === id)) return null
  return <Sheet key={id} />
}

function Sheet() {
  const { id } = useParams()
  const all = useTransactions()
  const existing = all.find((t) => t.id === id)
  const navigate = useNavigate()
  const location = useLocation()
  const [symbol] = useAtom(currencyAtom)
  const [params] = useSearchParams()
  // opened from the + menu's Camera or Voice: parse first, then show the review layout
  const [capture] = useState<Capture | undefined>(() => {
    const via = params.get('via')
    const c = peekCapture()
    return !id && c && ((via === 'camera' && c.kind === 'image') || (via === 'voice' && c.kind === 'audio')) ? c : undefined
  })
  const [editAmount, setEditAmount] = useState(false)
  const orbRef = useRef<HTMLDivElement>(null)

  const [type, setType] = useState<TxType>(existing?.type ?? 'expense')
  const customCats = useCustomCategories().filter((c) => c.type === type)
  const [input, setInput] = useState(existing ? amountToInput(existing.amount) : '')
  const [cat, setCat] = useState<string | undefined>(existing?.category)
  const [date, setDate] = useState(existing?.date ?? today())
  const [note, setNote] = useState(existing?.note ?? '')
  const [merchant, setMerchant] = useState(existing?.merchant ?? '')
  const [armDelete, setArmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [writeError, setWriteError] = useState('')
  const writing = useRef(false)
  const [draftId] = useState(() => existing?.id ?? uid())
  const [createdAt] = useState(() => existing?.createdAt ?? Date.now())
  const [hints, setHints] = useState<Set<Field>>(new Set())
  const [sub, setSub] = useState<'cats' | 'photo'>()
  const [phase, setPhase] = useState<Phase>(capture ? (capture.kind === 'audio' ? 'requesting' : 'busy') : 'idle')
  const [source, setSource] = useState<'audio' | 'image'>(capture?.kind ?? 'image')
  const [heard, setHeard] = useState('')
  const [parseError, setParseError] = useState('')
  // a new JPEG to attach, null = removed, undefined = unchanged (the stored one, if any)
  const [photo, setPhoto] = useState<Blob | null>()
  const [photoError, setPhotoError] = useState('')
  const [shrinking, setShrinking] = useState(0) // Save waits, or the photo would be dropped
  const fileRef = useRef<HTMLInputElement>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const parseReq = useRef<AbortController | null>(null)
  const micReq = useRef(0) // bumped to drop a getUserMedia that resolves after Stop
  const alive = useRef(true)
  const amountRef = useRef<HTMLDivElement>(null)

  // history nav is async, so the sheet stays up long enough to take a second tap
  const closing = useRef(false)
  const close = () => {
    if (closing.current || writing.current) return
    closing.current = true
    if (location.state?.bg) navigate(-1)
    else navigate('/', { replace: true })
  }
  const drag = useDragClose(close, saving)
  const amount = parseAmount(input)
  const working = phase === 'requesting' || phase === 'rec' || phase === 'busy'
  const canSave = amount > 0 && !!cat && !working && !shrinking && !saving
  const changed = !existing || photo !== undefined || type !== existing.type || amount !== existing.amount || cat !== existing.category ||
    date !== existing.date || note.trim() !== (existing.note ?? '') || merchant.trim() !== (existing.merchant ?? '')
  const unhint = (f: Field) => setHints((h) => (h.has(f) ? new Set([...h].filter((x) => x !== f)) : h))

  const localUrl = useMemo(() => photo && URL.createObjectURL(photo), [photo])
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl) }, [localUrl])
  const photoUrl = localUrl ?? (photo === undefined && existing?.photoAt ? `/api/tx/${existing.id}/photo?v=${existing.photoAt}` : undefined)

  function attach(file: Blob) {
    setPhotoError('')
    setShrinking((n) => n + 1)
    toJpeg(file).then((jpeg) => alive.current && setPhoto(jpeg), (err) => {
      console.error('[photo]', err)
      if (alive.current) setPhotoError('Couldn’t use that image. Try another photo.')
    }).finally(() => alive.current && setShrinking((n) => n - 1))
  }

  // stop the mic if the sheet closes mid-recording
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearCapture()
      parseReq.current?.abort()
      if (recRef.current?.state === 'recording') recRef.current.stop()
    }
  }, [])

  // deferred a tick so StrictMode's dev remount doesn't start it twice
  useEffect(() => {
    if (!capture) return
    const t = setTimeout(() => {
      if (capture.kind === 'audio') return void startMic(capture.stream)
      attach(capture.file)
      void run(capture.file, 'image')
    })
    return () => clearTimeout(t)
  }, [capture]) // eslint-disable-line react-hooks/exhaustive-deps

  // opened from Voice's Edit: start from its guess, marked as guessed
  useEffect(() => {
    const draft = (location.state as { draft?: Guess } | null)?.draft
    if (!id && !capture && draft) apply(draft)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [shownAmount, hints, editAmount])

  // a failed read lands on the amount keypad in the review layout
  function fail() {
    setPhase('failed')
    setEditAmount(true)
  }

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
    if (!categories(t).some((c) => c.id === cat)) setCat(undefined)
  }

  function pick(c: string) {
    setCat(c)
    unhint('cat')
    setSub(undefined)
  }

  function apply(g: Guess): boolean {
    const found = new Set<Field>()
    const t = g.type === 'income' || g.type === 'expense' ? g.type : type
    if (t !== type) { setType(t); found.add('type') }
    if (g.amount && Number.isSafeInteger(g.amount) && g.amount > 0) { setInput(amountToInput(g.amount)); found.add('amount') }
    if (g.date && /^\d{4}-\d{2}-\d{2}$/.test(g.date)) { setDate(g.date); found.add('date') }
    if (g.category && categories(t).some((c) => c.id === g.category)) {
      setCat(g.category)
      found.add('cat')
    } else if (!categories(t).some((c) => c.id === cat)) setCat(undefined)
    if (g.note) { setNote(g.note.slice(0, 80)); found.add('note') }
    if (g.merchant) { setMerchant(g.merchant.slice(0, 80)); found.add('merchant') }
    setHeard(g.heard ?? '')
    setHints(found)
    return found.has('amount') || found.has('cat') || found.has('date') || found.has('merchant')
  }

  async function run(blob: Blob, kind: 'audio' | 'image') {
    parseReq.current?.abort()
    const request = new AbortController()
    parseReq.current = request
    setParseError('')
    setSource(kind)
    setPhase('busy')
    try {
      await categoryRepo.load().catch(() => {})
      const guess = await parse(blob, kind, symbol, request.signal)
      if (alive.current && !request.signal.aborted) if (apply(guess)) setPhase('idle'); else fail()
    } catch (err) {
      if (alive.current && !request.signal.aborted) {
        setParseError(err instanceof Error ? err.message : '')
        fail()
      }
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    attach(file)
    setSub(undefined)
    // replacing a saved entry's receipt keeps what the user already has
    if (!existing) void run(file, 'image')
  }

  async function toggleMic() {
    if (phase === 'requesting' || phase === 'rec') {
      if (recRef.current?.state === 'recording') recRef.current.stop()
      else { micReq.current++; setPhase('idle') } // still on the permission prompt: cancel
      return
    }
    return startMic()
  }

  async function startMic(given?: Promise<MediaStream>) {
    const id = ++micReq.current
    setParseError('')
    setSource('audio')
    setPhase('requesting')
    try {
      const stream = await (given ?? navigator.mediaDevices.getUserMedia({ audio: true }))
      if (!alive.current || id !== micReq.current) return stream.getTracks().forEach((t) => t.stop())
      let rec: MediaRecorder
      try { rec = new MediaRecorder(stream) } catch (err) {
        stream.getTracks().forEach((t) => t.stop())
        throw err
      }
      const chunks: Blob[] = []
      const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), MAX_REC_MS)
      let meter: ReturnType<typeof setInterval> | undefined
      let audio: AudioContext | undefined
      let noSpeech = false
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        clearTimeout(timer)
        clearInterval(meter)
        void audio?.close()
        stream.getTracks().forEach((t) => t.stop())
        recRef.current = null
        if (!alive.current) return
        if (noSpeech) { setParseError('No speech heard. Try again.'); fail() }
        else void run(new Blob(chunks, { type: rec.mimeType }), 'audio')
      }
      recRef.current = rec
      try { rec.start() } catch (err) {
        clearTimeout(timer)
        recRef.current = null
        stream.getTracks().forEach((t) => t.stop())
        throw err
      }
      setPhase('rec')
      try {
        audio = new AudioContext()
        const analyser = audio.createAnalyser()
        analyser.fftSize = 2048
        audio.createMediaStreamSource(stream).connect(analyser)
        if (audio.state === 'suspended') void audio.resume().catch(() => {})
        const samples = new Uint8Array(analyser.fftSize)
        const started = performance.now()
        let voiceMs = 0
        let lastVoice = started
        meter = setInterval(() => {
          if (rec.state !== 'recording' || audio?.state !== 'running') return
          analyser.getByteTimeDomainData(samples)
          let sum = 0
          for (const sample of samples) sum += ((sample - 128) / 128) ** 2
          const level = Math.sqrt(sum / samples.length)
          orbRef.current?.style.setProperty('--level', String(Math.min(1, level * 6)))
          const now = performance.now()
          if (level > 0.018) {
            voiceMs += 100
            lastVoice = now
          }
          if (voiceMs >= 200 && now - lastVoice >= SILENCE_MS) rec.stop()
          else if (voiceMs < 200 && now - started >= NO_SPEECH_MS) { noSpeech = true; rec.stop() }
        }, 100)
      } catch (err) {
        console.error('[mic level]', err)
      }
    } catch (err) {
      console.error('[mic]', err)
      if (alive.current && id === micReq.current) fail()
    }
  }

  async function save() {
    if (!canSave || !changed || closing.current || writing.current) return
    writing.current = true
    setSaving(true)
    setWriteError('')
    try {
      await repo.save({
        id: draftId, type, amount, category: cat!, date, note: note.trim() || undefined,
        merchant: merchant.trim() || undefined, createdAt, photoAt: existing?.photoAt,
      }, photo === null && !existing?.photoAt ? undefined : photo)
      writing.current = false
      close()
    } catch {
      setWriteError('Could not confirm saving your entry. Your changes are still here. Try again.')
    } finally { writing.current = false; if (alive.current) setSaving(false) }
  }

  async function remove() {
    if (writing.current) return
    if (!armDelete) return setArmDelete(true)
    if (!existing) return
    writing.current = true
    setSaving(true)
    setWriteError('')
    try {
      await repo.remove(existing.id)
      writing.current = false
      close()
    } catch {
      setWriteError('Could not confirm deletion. Your entry is still shown. Try again.')
      setArmDelete(false)
    } finally { writing.current = false; if (alive.current) setSaving(false) }
  }

  const h = (f: Field) => (hints.has(f) ? 'hint' : '')

  if (capture?.kind === 'audio' && working) {
    return <VoiceView phase={phase} orbRef={orbRef} onFinish={() => void toggleMic()} onCancel={close} />
  }

  const header = (
    <div className="handle" {...drag.handlers}>
      <div className="grab" aria-hidden />
      <div className="row between">
        <label className={`chip ${date !== today() ? 'date-off' : ''} ${h('date')}`} aria-label="Date">
          <CalendarDays size={16} />{dayLabel(date)}
          <input type="date" aria-label="Date" disabled={saving} value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); unhint('date') } }} />
        </label>
        <div className={hints.has('type') ? 'hint-seg' : undefined}><TypeToggle value={type} onChange={switchType} disabled={saving} /></div>
        <button className="icon-btn" aria-label="Close entry" disabled={saving} onClick={close}><X size={20} /></button>
      </div>
    </div>
  )
  const warning = phase === 'failed' && (
    <div className="warn" role="alert">
      <TriangleAlert size={18} />
      {parseError || (source === 'image' ? 'Couldn’t read the receipt. Type the amount instead.' : 'Couldn’t understand that. Type it instead.')}
    </div>
  )
  const keypad = (
    <div className={`keys ${phase === 'failed' ? 'compact' : ''}`}>
      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map((k) => (
        <button key={k} className="key" disabled={saving} onClick={() => press(k)}>{k}</button>
      ))}
      <button className="key del" aria-label="Backspace" disabled={saving} onClick={() => press('del')}><Delete size={24} /></button>
    </div>
  )
  const readingReceipt = (
    <div className="ai-panel" aria-live="polite">
      {source === 'image' && photoUrl && <img className="thumb" src={photoUrl} alt="" />}
      <LoaderCircle size={36} className="spin accent" />
      <div className="lbl">{source === 'image' ? 'Reading receipt…' : 'Reading what you said…'}</div>
      <div className="sub">You can review the details before saving.</div>
    </div>
  )
  const amountText = (
    <div ref={amountRef} className={`amount num ${!input ? 'empty' : type === 'income' ? 'inc' : 'exp'}`} aria-live="polite">
      {shownAmount}
    </div>
  )
  const legacyCat = cat && CATEGORIES[type].some((c) => c.id === cat) && !ACTIVE_CATEGORIES[type].some((c) => c.id === cat) ? category(cat) : undefined
  const LegacyIcon = legacyCat?.icon
  const catSheet = sub === 'cats' && (
    <SubSheet label="Category" onClose={() => setSub(undefined)}>
      {legacyCat && LegacyIcon && <>
        <div className="category-field-label">CURRENT CATEGORY</div>
        <div className="card category-list"><button className="category-item" aria-pressed="true" onClick={() => pick(legacyCat.id)}>
          <span className="cat" style={{ background: legacyCat.color }}><LegacyIcon size={22} /></span>{legacyCat.label}
          <Check size={18} className="chev" />
        </button></div>
      </>}
      {!!customCats.length && <>
        <div className="category-field-label">YOUR CATEGORIES</div>
        <div className="card category-list">
          {customCats.map((item) => {
            const c = category(item.id)
            return <button className="category-item" key={c.id} aria-pressed={cat === c.id} onClick={() => pick(c.id)}>
              <span className="cat" style={{ background: c.color }}><c.icon size={22} /></span>{c.label}
              {cat === c.id && <Check size={18} className="chev" />}
            </button>
          })}
        </div>
      </>}
      <div className="category-field-label">BUILT IN</div>
      <div className="cats" role="group" aria-label="Category">
        {ACTIVE_CATEGORIES[type].map((c) => (
          <button key={c.id} aria-pressed={cat === c.id} onClick={() => pick(c.id)}>
            <span className="cat" style={{ background: c.color }}><c.icon size={24} /></span>
            <span className="lbl">{c.label}</span>
          </button>
        ))}
      </div>
    </SubSheet>
  )

  const photoSheet = sub === 'photo' && photoUrl && (
    <SubSheet label="Receipt" onClose={() => setSub(undefined)}>
      <img className="photo" src={photoUrl} alt="Receipt" />
      <div className="row">
        <button className="pill grow" onClick={() => fileRef.current?.click()}>Replace</button>
        <button className="pill grow exp" onClick={() => { setPhoto(null); setSub(undefined) }}>Remove</button>
      </div>
    </SubSheet>
  )
  const fileInput = <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />

  const c = cat ? category(cat) : undefined
  const dot = <span className="hint-mark" aria-label="Guessed" />
  return (
    <>
      <Modal onDismiss={close} busy={saving} className={`glass sheet review-sheet ${sub ? 'behind' : ''}`} aria-label={existing ? 'Edit entry' : capture ? 'Review entry' : 'Add entry'} style={drag.style}>
        {header}
        {writeError && <div className="warn" role="alert">{writeError}</div>}
        {saving && <div className="sr" role="status">{armDelete ? 'Deleting entry…' : 'Saving changes…'}</div>}
        {phase === 'busy' ? readingReceipt : (
          <>
            {existing ? (
              (merchant || photoUrl) && <div className="review-source">{[merchant, photoUrl && 'receipt attached'].filter(Boolean).join(' · ')}</div>
            ) : capture && source === 'image' ? (
              <div className="review-source">
                From your receipt{merchant && ` · ${merchant}`}
                {!!hints.size && <> · {dot} = our guess, tap to change</>}
              </div>
            ) : null}
            {heard && <div className="heard">“{heard}”</div>}
            {warning}
            {editAmount ? (
              <div className="review-amount editing"><small>Amount</small>{amountText}</div>
            ) : (
              <button className="review-amount" disabled={saving} onClick={() => setEditAmount(true)}>
                <small>Amount{hints.has('amount') && <> {dot}</>}</small>{amountText}<span className="edit-cue">Tap to edit</span>
              </button>
            )}
            <button className="review-category" disabled={saving} onClick={() => setSub('cats')}>
              {c ? <span className="cat" style={{ background: c.color }}><c.icon size={24} /></span> : <span className="cat more"><Ellipsis size={24} /></span>}
              <span className="value"><small>Category</small><strong>{c?.label ?? 'Choose category'}</strong></span>
              {hints.has('cat') && dot}
              <ChevronRight size={16} className="chev" />
            </button>
            {editAmount ? (
              <>
                {keypad}
                <button className="review-save" onClick={() => setEditAmount(false)}>Done</button>
              </>
            ) : (
              <>
                <label className="review-row">
                  <span className="tile note"><NotebookPen size={22} /></span>
                  <span className="value"><small>Note</small>
                    <input disabled={saving} value={note} placeholder="Add a note" maxLength={80} onChange={(e) => { setNote(e.target.value); unhint('note') }} />
                  </span>
                  {hints.has('note') && dot}
                </label>
                {(!capture || capture.kind === 'image') && (
                  <button className="review-row" disabled={saving} onClick={() => (photoUrl ? setSub('photo') : fileRef.current?.click())}>
                    {photoUrl ? <img className="tile" src={photoUrl} alt="" /> : <span className="tile add"><Camera size={22} /></span>}
                    <span className="value"><small>Receipt</small><strong>{photoUrl ? 'View photo' : 'Add receipt photo'}</strong></span>
                    <ChevronRight size={16} className="chev" />
                  </button>
                )}
                {photoError && <div className="warn" role="alert"><TriangleAlert size={18} />{photoError}</div>}
                {existing ? (
                  <div className="edit-bar">
                    <button className={`round ${armDelete ? 'armed' : 'exp'}`} aria-label={armDelete ? 'Confirm delete' : 'Delete'} disabled={saving} onClick={() => void remove()}>
                      <Trash2 size={22} />
                    </button>
                    <button className="review-save" disabled={!canSave || !changed} onClick={() => void save()}>{saving ? armDelete ? 'Deleting…' : 'Saving…' : 'Save changes'}</button>
                  </div>
                ) : (
                  <button className="review-save" disabled={!canSave} onClick={() => void save()}>{saving ? 'Saving…' : 'Save entry'}</button>
                )}
              </>
            )}
          </>
        )}
        {fileInput}
      </Modal>
      {catSheet}
      {photoSheet}
    </>
  )
}

/** Full-screen listening view for Voice from the + menu. Words come back with the review, not live. */
function VoiceView({ phase, orbRef, onFinish, onCancel }: {
  phase: Phase; orbRef: React.RefObject<HTMLDivElement | null>; onFinish: () => void; onCancel: () => void
}) {
  const [status, guide] = phase === 'busy'
    ? ['Reading what you said…', 'You can check it before saving']
    : phase === 'requesting'
      ? ['Connecting microphone', 'Allow microphone access']
      : ['Listening', 'Say the amount and what it was for']
  return (
    <Modal onDismiss={onCancel} className={`voice-mode ${phase}`} aria-label="Voice entry">
      <div className="vm-title">Voice entry</div>
      <div className="vm-center">
        <div className="orb-wrap" aria-hidden><div ref={orbRef} className="orb" /></div>
        <div className="vm-status" aria-live="polite">{phase === 'rec' && <span className="voice-dot" />}{status}</div>
        <p className="vm-guide">{guide}</p>
      </div>
      <div className="vm-bar">
        <button className="vm-round finish" aria-label="Finish recording" disabled={phase !== 'rec'} onClick={onFinish}><Check size={26} strokeWidth={2.4} /></button>
        <button className="vm-round cancel" aria-label="Cancel voice entry" onClick={onCancel}><X size={26} strokeWidth={2.4} /></button>
      </div>
    </Modal>
  )
}

/** A second sheet stacked on top of the Add sheet (iOS-style). */
function SubSheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const drag = useDragClose(onClose)
  return (
    <Modal onDismiss={onClose} className="glass sheet sub" aria-label={label} style={drag.style}>
        <div className="handle" {...drag.handlers}>
          <div className="grab" aria-hidden />
          <div className="row between"><h2 className="sheet-title">{label}</h2><button className="icon-btn" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}><X size={20} /></button></div>
        </div>
        {children}
    </Modal>
  )
}
