import { ImagePlus, Trash2, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { parseAmount, today, uid, amountToInput } from '../lib/format'
import { toJpeg } from '../lib/image'
import { repo, useTransactions } from '../lib/store'
import { EntryForm, type Fields } from './EntryForm'

/** New entry (/add) and Edit entry (/tx/:id) as a panel on the right. Replaces the phone's sheet on desktop. */
export function EntryPanel() {
  const { id } = useParams()
  const all = useTransactions()
  // the fields start from the transaction, so wait until the list has loaded
  if (id && !all.some((t) => t.id === id)) return null
  return <Panel key={id} />
}

function Panel() {
  const { id } = useParams()
  const existing = useTransactions().find((t) => t.id === id)
  const navigate = useNavigate()
  const location = useLocation()
  const [fields, setFields] = useState<Fields>(() => ({
    type: existing?.type ?? 'expense', input: existing ? amountToInput(existing.amount) : '', date: existing?.date ?? today(),
    cat: existing?.category, note: existing?.note ?? '',
  }))
  const [draftId] = useState(() => existing?.id ?? uid())
  const [createdAt] = useState(() => existing?.createdAt ?? Date.now())
  // a new JPEG to attach, null = removed, undefined = unchanged (the stored one, if any)
  const [photo, setPhoto] = useState<Blob | null>()
  const [photoError, setPhotoError] = useState('')
  const [shrinking, setShrinking] = useState(0) // Save waits, or the photo would be dropped
  const [armDelete, setArmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const writing = useRef(false)
  const closing = useRef(false)
  const alive = useRef(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    alive.current = true
    // after the dialog opens, which moves focus to its first button
    if (!existing) amountRef.current?.focus()
    return () => { alive.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const localUrl = useMemo(() => photo && URL.createObjectURL(photo), [photo])
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl) }, [localUrl])
  const photoUrl = localUrl ?? (photo === undefined && existing?.photoAt ? `/api/tx/${existing.id}/photo?v=${existing.photoAt}` : undefined)

  const amount = parseAmount(fields.input)
  const note = fields.note.trim()
  const changed = !existing || photo !== undefined || fields.type !== existing.type || amount !== existing.amount ||
    fields.cat !== existing.category || fields.date !== existing.date || note !== (existing.note ?? '')
  const canSave = amount > 0 && !!fields.cat && changed && !shrinking && !saving

  // history nav is async, so the panel stays up long enough to take a second click
  const close = () => {
    if (closing.current || writing.current) return
    closing.current = true
    if (location.state?.bg) navigate(-1)
    else navigate('/', { replace: true })
  }

  function attach(file: Blob) {
    setPhotoError('')
    setShrinking((n) => n + 1)
    toJpeg(file).then((jpeg) => alive.current && setPhoto(jpeg), (err) => {
      console.error('[photo]', err)
      if (alive.current) setPhotoError('Couldn’t use that image. Try a JPG or PNG.')
    }).finally(() => alive.current && setShrinking((n) => n - 1))
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canSave || closing.current || writing.current) return
    writing.current = true
    setSaving(true)
    setError('')
    try {
      await repo.save({
        id: draftId, type: fields.type, amount, category: fields.cat!, date: fields.date, note: note || undefined,
        merchant: existing?.merchant, createdAt, photoAt: existing?.photoAt,
      }, photo === null && !existing?.photoAt ? undefined : photo)
      writing.current = false
      close()
    } catch {
      if (alive.current) setError('Could not confirm saving your entry. Your changes are still here. Try again.')
    } finally { writing.current = false; if (alive.current) setSaving(false) }
  }

  async function remove() {
    if (writing.current || !existing) return
    if (!armDelete) return setArmDelete(true)
    writing.current = true
    setSaving(true)
    setError('')
    try {
      await repo.remove(existing.id)
      writing.current = false
      close()
    } catch {
      if (alive.current) { setError('Could not confirm deletion. Your entry is still shown. Try again.'); setArmDelete(false) }
    } finally { writing.current = false; if (alive.current) setSaving(false) }
  }

  const title = existing ? 'Edit entry' : 'New entry'
  return (
    <Modal onDismiss={close} busy={saving} className="sheet wd-panel" aria-label={title}>
      <form className="wd-panel-form" onSubmit={(e) => void save(e)}>
        <header className="wd-panel-head"><h2>{title}</h2><button type="button" className="icon-btn" aria-label={`Close ${title.toLowerCase()}`} disabled={saving} onClick={close}><X size={20} /></button></header>
        <div className="wd-panel-body">
          {existing?.merchant && <div className="review-source">{existing.merchant}</div>}
          {error && <div className="warn" role="alert">{error}</div>}
          <EntryForm value={fields} disabled={saving} amountRef={amountRef} onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}>
            <div className="wd-fld">
              <span>Receipt</span>
              {photoUrl ? (
                <div className="wd-rcpt">
                  <a href={photoUrl} target="_blank" rel="noopener"><img src={photoUrl} alt="Receipt" /></a>
                  <span className="t">Receipt photo</span>
                  <button type="button" className="wd-lnk" disabled={saving} onClick={() => fileRef.current?.click()}>Replace</button>
                  <button type="button" className="wd-lnk" disabled={saving} onClick={() => setPhoto(null)}>Remove</button>
                </div>
              ) : (
                <button type="button" className="wd-rcpt wd-attach" disabled={saving || !!shrinking} onClick={() => fileRef.current?.click()}><ImagePlus size={18} />Attach photo</button>
              )}
              {photoError && <div className="warn" role="alert"><TriangleAlert size={18} />{photoError}</div>}
            </div>
          </EntryForm>
        </div>
        <footer className="wd-foot">
          {existing && <button type="button" className={`wd-btn danger${armDelete ? ' armed' : ''}`} disabled={saving} onClick={() => void remove()}>
            <Trash2 size={18} />{armDelete ? 'Confirm delete' : 'Delete'}</button>}
          <span className="grow" />
          <button type="button" className="wd-btn" disabled={saving} onClick={close}>Cancel</button>
          <button type="submit" className="wd-btn primary" disabled={!canSave}>{saving ? (armDelete ? 'Deleting…' : 'Saving…') : existing ? 'Save changes' : 'Save entry'}</button>
        </footer>
        {saving && <div className="sr" role="status">{armDelete ? 'Deleting entry…' : 'Saving changes…'}</div>}
      </form>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) attach(file)
      }} />
    </Modal>
  )
}
