import { Check, ChevronRight, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDragClose } from '../hooks/useDragClose'
import { ACTIVE_CATEGORIES, COLORS, ICONS, categoryRepo, useCustomCategories } from '../lib/categories'
import type { CustomCategory, TxType } from '../lib/types'

type Draft = Omit<CustomCategory, 'id'> & { id?: string }
const REVEAL = 96
const COLOR_NAMES = ['Green', 'Amber', 'Indigo', 'Blue', 'Orange', 'Pink', 'Purple']

export function Categories({ addRequest }: { addRequest: number }) {
  const custom = useCustomCategories()
  const handledRequest = useRef(addRequest)
  const [type, setType] = useState<TxType>('expense')
  const [draft, setDraft] = useState<Draft>()
  const [openId, setOpenId] = useState<string>()
  const [pending, setPending] = useState(false)
  const [deleteReady, setDeleteReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const customForType = custom.filter((c) => c.type === type)

  useEffect(() => {
    let active = true
    categoryRepo.load().catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [loadAttempt])

  function open(next: Draft) {
    setDraft(next)
    setOpenId(undefined)
    setDeleteReady(false)
    setError('')
  }

  function close() { setDraft(undefined); setDeleteReady(false); setError('') }

  useEffect(() => {
    if (addRequest === handledRequest.current) return
    handledRequest.current = addRequest
    open({ type, label: '', icon: type === 'income' ? 'briefcase' : 'bag', color: type === 'income' ? COLORS[0] : COLORS[3], clues: '' })
  }, [addRequest, type])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft || pending) return
    const label = draft.label.trim()
    if (!label) return setError('Enter a category name.')
    const names = [...custom.filter((c) => c.type === draft.type && c.id !== draft.id), ...ACTIVE_CATEGORIES[draft.type]]
    if (names.some((c) => c.label.toLocaleLowerCase() === label.toLocaleLowerCase())) return setError('This category name already exists.')
    setPending(true)
    setError('')
    try {
      await categoryRepo.save({ type: draft.type, label, icon: draft.icon, color: draft.color, clues: draft.clues.trim() }, draft.id)
      setType(draft.type)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save category.')
    } finally { setPending(false) }
  }

  async function remove(id: string) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await categoryRepo.remove(id)
      setOpenId(undefined)
      if (draft?.id === id) close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.')
      setDeleteReady(false)
    } finally { setPending(false) }
  }

  return (
    <main className="screen category-screen">
      <h1>Categories</h1>
      <div className="seg category-type" role="group" aria-label="Category type">
        <button className="e" aria-pressed={type === 'expense'} onClick={() => { setType('expense'); setOpenId(undefined) }}>Expense</button>
        <button className="i" aria-pressed={type === 'income'} onClick={() => { setType('income'); setOpenId(undefined) }}>Income</button>
      </div>
      {error && !draft && <div className="warn" role="alert">{error}</div>}
      <div className="category-field-label">BUILT IN</div>
      <section className="card category-list">
        {ACTIVE_CATEGORIES[type].map((c) => <div className="category-item" key={c.id}><span className="cat" style={{ background: c.color }}><c.icon size={22} /></span><span>{c.label}</span></div>)}
      </section>
      <div className="category-field-label">YOUR CATEGORIES</div>
      <section className="card category-list">
        {customForType.map((c) => <CategoryRow key={c.id} item={c} open={openId === c.id} pending={pending} onOpen={(shown) => setOpenId(shown ? c.id : undefined)} onEdit={() => open(c)} onDelete={() => void remove(c.id)} />)}
        {loading && <div className="category-item muted">Loading…</div>}
        {!loading && loadError && <div className="category-empty">Could not load your categories.<button className="category-retry" onClick={() => { setLoading(true); setLoadError(false); setLoadAttempt((n) => n + 1) }}>Try again</button></div>}
        {!loading && !loadError && customForType.length === 0 && <div className="category-empty">No custom {type} categories yet. Tap + to add one.</div>}
      </section>
      {draft && <CategoryModal draft={draft} pending={pending} error={error} deleteReady={deleteReady}
        onChange={(next) => { setDraft(next); setError(''); setDeleteReady(false) }} onClose={close} onSave={save}
        onDelete={() => deleteReady ? void remove(draft.id!) : setDeleteReady(true)} />}
    </main>
  )
}

function CategoryModal({ draft, pending, error, deleteReady, onChange, onClose, onSave, onDelete }: {
  draft: Draft; pending: boolean; error: string; deleteReady: boolean; onChange: (draft: Draft) => void
  onClose: () => void; onSave: (e: React.FormEvent) => void; onDelete: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const drag = useDragClose(onClose, pending)
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const modal = dialog.current!
    modal.showModal()
    return () => { modal.close(); trigger?.focus() }
  }, [])
  return <dialog ref={dialog} className="category-modal" style={drag.style} aria-labelledby="category-modal-title"
    aria-describedby="category-modal-context" onCancel={(e) => { e.preventDefault(); if (!pending) onClose() }}
    onClick={(e) => {
      if (pending || e.target !== e.currentTarget) return
      const r = e.currentTarget.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose()
    }}>
    <div className="modal-handle" {...drag.handlers}>
      <div className="grab" aria-hidden />
      <div className="category-modal-head"><h2 id="category-modal-title">{draft.id ? 'Edit category' : 'New category'}</h2>
        <button type="button" aria-label="Close category" disabled={pending} onClick={onClose}><X size={20} /></button></div>
      <p className="category-modal-context" id="category-modal-context">{draft.type === 'expense' ? 'Expense' : 'Income'} category</p>
    </div>
    <form className="category-form" onSubmit={onSave}>
      <label className="category-field-label" htmlFor="category-name">NAME</label>
      <div className="card category-name"><span className="cat" style={{ background: draft.color }}>{renderIcon(draft.icon)}</span>
        <input id="category-name" value={draft.label} maxLength={40} placeholder="Category name" autoFocus disabled={pending}
          onChange={(e) => onChange({ ...draft, label: e.target.value })} /></div>
      <div className="category-field-label">ICON</div>
      <div className="category-choices" role="group" aria-label="Icon">
        {Object.entries(ICONS).map(([name, Icon]) => <button type="button" key={name} aria-label={name}
          aria-pressed={draft.icon === name} disabled={pending} onClick={() => onChange({ ...draft, icon: name })}><Icon size={22} /></button>)}
      </div>
      <div className="category-field-label">COLOR · {COLOR_NAMES[COLORS.indexOf(draft.color)] ?? 'Custom'}</div>
      <div className="category-modal-colors" role="group" aria-label="Color">
        {COLORS.map((color, i) => <button type="button" key={color} aria-label={COLOR_NAMES[i]} aria-pressed={draft.color === color}
          disabled={pending} onClick={() => onChange({ ...draft, color })}>
          <span style={{ background: color }}>{draft.color === color && <Check size={18} />}</span></button>)}
      </div>
      {error && <div className="warn" role="alert">{error}</div>}
      {draft.id && <button className="category-delete" type="button" disabled={pending} onClick={onDelete}>
        <Trash2 size={18} />{deleteReady ? 'Confirm delete' : 'Delete category'}</button>}
      <div className="category-modal-actions">
        <button className="category-modal-cancel" type="button" disabled={pending} onClick={onClose}>Cancel</button>
        <button className="category-modal-save" type="submit" disabled={pending || !draft.label.trim()}>
          {pending ? 'Saving…' : draft.id ? 'Save changes' : 'Add category'}</button>
      </div>
    </form>
  </dialog>
}

function renderIcon(name: string) {
  const Icon = ICONS[name] ?? ICONS.briefcase
  return <Icon size={22} />
}

function CategoryRow({ item, open, pending, onOpen, onEdit, onDelete }: {
  item: CustomCategory; open: boolean; pending: boolean; onOpen: (open: boolean) => void; onEdit: () => void; onDelete: () => void
}) {
  const [dx, setDx] = useState<number>()
  const drag = useRef<{ x: number; y: number; id: number; swiping: boolean; moved: boolean; dx: number }>(null)
  const base = open ? -REVEAL : 0
  const x = dx ?? base
  const Icon = ICONS[item.icon]
  return (
    <div className={`category-swipe ${open || (dx ?? 0) < 0 ? 'revealed' : ''}`}>
      <button className="category-swipe-delete" aria-label={`Delete ${item.label}`} tabIndex={open ? 0 : -1} disabled={pending} onClick={onDelete}>Delete</button>
      <button className="category-item category-swipe-content" style={{ transform: x ? `translateX(${x}px)` : undefined, transition: dx === undefined ? undefined : 'none' }}
        onPointerDown={(e) => { if (e.pointerType !== 'mouse' || e.button === 0) drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false, moved: false, dx: base } }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const mx = e.clientX - d.x
          const my = e.clientY - d.y
          if (!d.swiping) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { drag.current = null; return }
            if (Math.abs(mx) < 10) return
            d.swiping = true
            d.moved = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          d.dx = Math.max(-REVEAL * 1.5, Math.min(0, base + mx))
          setDx(d.dx)
        }}
        onPointerUp={() => { const d = drag.current; if (!d?.swiping) return; onOpen(d.dx < -REVEAL / 2); setDx(undefined) }}
        onPointerCancel={() => { drag.current = null; setDx(undefined) }}
        onClick={() => { if (drag.current?.moved) { drag.current = null; return }; drag.current = null; if (open) onOpen(false); else onEdit() }}>
        <span className="cat" style={{ background: item.color }}>{Icon && <Icon size={22} />}</span>
        <span className="category-item-text"><strong>{item.label}</strong></span><ChevronRight size={18} />
      </button>
    </div>
  )
}
