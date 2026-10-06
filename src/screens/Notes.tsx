import { ArrowDown, NotebookPen, NotebookText, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { SwipeRow } from '../components/ui'
import { useDragClose } from '../hooks/useDragClose'
import { dayLabel, toDateKey, uid } from '../lib/format'
import { noteParts, notesRepo, useNotes } from '../lib/notes'
import type { Note } from '../lib/types'

const UNDO_MS = 5_000
const MAX_NOTE = 2000

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function Notes() {
  const notes = useNotes()
  const navigate = useNavigate()
  const location = useLocation()
  const [openId, setOpenId] = useState<string>()
  // deleted on the server at once; Undo saves it back
  const [undo, setUndo] = useState<Note>()
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt)
  const groups: [string, Note[]][] = []
  for (const n of sorted) {
    const day = toDateKey(new Date(n.createdAt))
    const last = groups[groups.length - 1]
    if (last && last[0] === day) last[1].push(n)
    else groups.push([day, [n]])
  }
  const open = (path: string) => navigate(path, { state: { bg: location } })

  async function remove(note: Note) {
    setOpenId(undefined)
    setError('')
    try {
      await notesRepo.remove(note.id)
      clearTimeout(timer.current)
      setUndo(note)
      timer.current = setTimeout(() => setUndo(undefined), UNDO_MS)
    } catch { setError('Could not delete the note. Try again.') }
  }
  async function restore() {
    if (!undo) return
    clearTimeout(timer.current)
    setUndo(undefined)
    await notesRepo.save(undo).catch(() => setError('Could not restore the note.'))
  }

  return (
    <main className="screen">
      <div className="row between month">
        <h1>Notes</h1>
        {!!notes.length && <span className="nt-count">{notes.length === 1 ? '1 note' : `${notes.length} notes`}</span>}
      </div>
      {error && <div className="warn" role="alert">{error}</div>}
      {notes.length ? (
        <div className="card list">
          {groups.map(([day, items]) => (
            <section key={day}>
              <div className="day">{dayLabel(day)}</div>
              {items.map((n) => {
                const [title, sub] = noteParts(n.text)
                return (
                  <SwipeRow key={n.id} open={openId === n.id} onOpen={(o) => setOpenId(o ? n.id : undefined)}
                    onDelete={() => void remove(n)} label={title}
                    onTap={() => (openId ? setOpenId(undefined) : open(`/notes/${n.id}`))}>
                    <span className="nt-tile"><NotebookPen size={20} /></span>
                    <div className="grow">
                      <div className="nt-title">{title}</div>
                      {sub && <div className="sub">{sub}</div>}
                    </div>
                    <span className="nt-time">{time(n.createdAt)}</span>
                  </SwipeRow>
                )
              })}
            </section>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="big" aria-hidden><NotebookText size={40} /></div>
          <p role="status">No notes yet.<br />Write one, or tap + and say it.</p>
          <button className="empty-action" onClick={() => open('/notes/new')}>New note</button>
          <ArrowDown size={26} className="bob" aria-hidden />
        </div>
      )}
      {undo && (
        <div className="glass undo" role="status">
          <span>Note deleted</span>
          <button onClick={() => void restore()}>Undo</button>
        </div>
      )}
    </main>
  )
}

export function NoteSheet() {
  const { id } = useParams()
  const notes = useNotes()
  // the text starts from the note, so wait until the list has loaded
  if (id && !notes.some((n) => n.id === id)) return null
  return <NoteEditor key={id} />
}

function NoteEditor() {
  const { id } = useParams()
  const existing = useNotes().find((n) => n.id === id)
  const navigate = useNavigate()
  const location = useLocation()
  // Voice's Edit hands over its proposed text
  const [text, setText] = useState(existing?.text ?? (location.state as { draft?: string } | null)?.draft ?? '')
  const [draftId] = useState(() => existing?.id ?? uid())
  const [createdAt] = useState(() => existing?.createdAt ?? Date.now())
  const [saving, setSaving] = useState(false)
  const [armDelete, setArmDelete] = useState(false)
  const [error, setError] = useState('')
  const closing = useRef(false)
  const close = () => {
    if (closing.current) return
    closing.current = true
    if (location.state?.bg) navigate(-1)
    else navigate('/notes', { replace: true })
  }
  const drag = useDragClose(close, saving)
  const trimmed = text.trim()
  const canSave = !!trimmed && trimmed !== existing?.text && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await notesRepo.save({ id: draftId, text: trimmed, createdAt, updatedAt: Date.now() })
      close()
    } catch {
      setError('Could not save the note. Your text is still here. Try again.')
      setSaving(false)
    }
  }
  async function remove() {
    if (!existing || saving) return
    if (!armDelete) return setArmDelete(true)
    setSaving(true)
    setError('')
    try {
      await notesRepo.remove(existing.id)
      close()
    } catch {
      setError('Could not delete the note. Try again.')
      setArmDelete(false)
      setSaving(false)
    }
  }

  return (
    <Modal onDismiss={close} busy={saving} className="glass sheet nt-sheet" aria-label={existing ? 'Edit note' : 'New note'} style={drag.style}>
      <div className="handle" {...drag.handlers}>
        <div className="grab" aria-hidden />
        <div className="row between">
          <button className="icon-btn" aria-label="Close note" disabled={saving} onClick={close}><X size={20} /></button>
          <h2 className="sheet-title">{existing ? 'Edit note' : 'New note'}</h2>
          <span className="nt-meta">{existing && `${dayLabel(toDateKey(new Date(existing.updatedAt)))} ${time(existing.updatedAt)}`}</span>
        </div>
      </div>
      {error && <div className="warn" role="alert">{error}</div>}
      <textarea className="nt-area" aria-label="Note" autoFocus={!existing} disabled={saving} maxLength={MAX_NOTE}
        placeholder="Write a note" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="nt-help">First line becomes the title.</p>
      {existing ? (
        <div className="edit-bar">
          <button className={`round ${armDelete ? 'armed' : 'exp'}`} aria-label={armDelete ? 'Confirm delete' : 'Delete note'} disabled={saving} onClick={() => void remove()}>
            <Trash2 size={22} />
          </button>
          <button className="review-save" disabled={!canSave} onClick={() => void save()}>{saving ? armDelete ? 'Deleting…' : 'Saving…' : 'Save changes'}</button>
        </div>
      ) : (
        <button className="review-save" disabled={!canSave} onClick={() => void save()}>{saving ? 'Saving…' : 'Save note'}</button>
      )}
    </Modal>
  )
}
