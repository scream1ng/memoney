import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ACTIVE_CATEGORIES, COLORS, ICONS, categoryRepo, useCustomCategories } from '../lib/categories'
import type { CustomCategory, TxType } from '../lib/types'

type Draft = Omit<CustomCategory, 'id'> & { id?: string }
const REVEAL = 96
const COLOR_NAMES = ['Green', 'Amber', 'Indigo', 'Blue', 'Orange', 'Pink', 'Purple']

export function Categories() {
  const custom = useCustomCategories()
  const [type, setType] = useState<TxType>('expense')
  const [draft, setDraft] = useState<Draft>()
  const [choice, setChoice] = useState<Draft>()
  const [openId, setOpenId] = useState<string>()
  const [pending, setPending] = useState(false)
  const [deleteReady, setDeleteReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    categoryRepo.load().catch(() => active && setError('Could not load categories. Try reopening this page.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  function open(next: Draft) {
    setDraft(next)
    setChoice(undefined)
    setOpenId(undefined)
    setDeleteReady(false)
    setError('')
  }

  function close() { setDraft(undefined); setChoice(undefined); setDeleteReady(false); setError('') }

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
    <main className={`screen category-screen${draft ? ' category-detail' : ''}`}>
      {choice && draft ? (
        <>
          <div className="category-context">{draft.type === 'expense' ? 'EXPENSE CATEGORY' : 'INCOME CATEGORY'}</div>
          <h1>Icon &amp; color</h1>
          <div className="category-field-label">PREVIEW</div>
          <div className="card category-preview"><span className="cat" style={{ background: choice.color }}>{renderIcon(choice.icon)}</span><strong>{draft.label.trim() || 'New category'}</strong></div>
          <div className="category-field-label">ICON</div>
          <div className="category-choices" role="group" aria-label="Icon">
            {Object.entries(ICONS).map(([name, Icon]) => <button type="button" key={name} aria-label={name} aria-pressed={choice.icon === name} onClick={() => setChoice({ ...choice, icon: name })}><Icon size={22} /></button>)}
          </div>
          <div className="category-field-label">COLOR · {COLOR_NAMES[COLORS.indexOf(choice.color)] ?? 'Custom'}</div>
          <div className="category-choices colors" role="group" aria-label="Color">
            {COLORS.map((color, i) => <button type="button" key={color} aria-label={COLOR_NAMES[i]} aria-pressed={choice.color === color} style={{ background: color }} onClick={() => setChoice({ ...choice, color })} />)}
          </div>
          <div className="category-extra">
            <label htmlFor="category-clues">HELP AI RECOGNIZE IT · OPTIONAL</label>
            <textarea id="category-clues" className="category-clues" value={choice.clues} maxLength={200} placeholder="Names or words associated with this category" onChange={(e) => setChoice({ ...choice, clues: e.target.value })} />
          </div>
          <div className="category-actions">
            <button className="glass category-secondary" onClick={() => setChoice(undefined)}>Back</button>
            <button className="glass review-save category-primary" onClick={() => { setDraft(choice); setChoice(undefined) }}>Apply</button>
          </div>
        </>
      ) : draft ? (
        <>
          <div className="category-context">{draft.type === 'expense' ? 'EXPENSE CATEGORY' : 'INCOME CATEGORY'}</div>
          <h1>{draft.id ? 'Edit category' : 'New category'}</h1>
          <form className="category-form" onSubmit={save}>
            <div className="category-field-label">NAME</div>
            <label className="card category-name"><span className="cat" style={{ background: draft.color }}>{renderIcon(draft.icon)}</span><input value={draft.label} maxLength={40} placeholder="Category name" aria-label="Category name" autoFocus disabled={pending} onChange={(e) => { setDraft({ ...draft, label: e.target.value }); setError('') }} /></label>
            <section className="card category-list"><button className="category-item" type="button" disabled={pending} onClick={() => setChoice({ ...draft })}>Icon &amp; color<ChevronRight size={18} /></button></section>
            {error && <div className="warn" role="alert">{error}</div>}
            {draft.id && <button className="category-delete" type="button" disabled={pending} onClick={() => deleteReady ? void remove(draft.id!) : setDeleteReady(true)}><Trash2 size={18} />{deleteReady ? 'Confirm delete' : 'Delete category'}</button>}
            <div className="category-actions">
              <button className="glass category-secondary" type="button" disabled={pending} onClick={close}>Cancel</button>
              <button className="glass review-save category-primary" type="submit" disabled={pending || !draft.label.trim()}>{pending ? 'Saving…' : draft.id ? 'Save changes' : 'Add category'}</button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h1>Categories</h1>
          <div className="seg category-type" role="group" aria-label="Category type">
            <button className="e" aria-pressed={type === 'expense'} onClick={() => { setType('expense'); setOpenId(undefined) }}>Expense</button>
            <button className="i" aria-pressed={type === 'income'} onClick={() => { setType('income'); setOpenId(undefined) }}>Income</button>
          </div>
          {error && <div className="warn" role="alert">{error}</div>}
          <div className="category-field-label">YOUR CATEGORIES</div>
          <section className="card category-list">
            {custom.filter((c) => c.type === type).map((c) => <CategoryRow key={c.id} item={c} open={openId === c.id} pending={pending} onOpen={(shown) => setOpenId(shown ? c.id : undefined)} onEdit={() => open(c)} onDelete={() => void remove(c.id)} />)}
            {loading && <div className="category-item muted">Loading…</div>}
            <button className="category-item add" onClick={() => open({ type, label: '', icon: type === 'income' ? 'briefcase' : 'bag', color: type === 'income' ? COLORS[0] : COLORS[3], clues: '' })}><span className="cat"><Plus size={22} /></span>Add category</button>
          </section>
          <div className="category-field-label">BUILT IN</div>
          <section className="card category-list">
            {ACTIVE_CATEGORIES[type].map((c) => <div className="category-item" key={c.id}><span className="cat" style={{ background: c.color }}><c.icon size={22} /></span><span>{c.label}</span></div>)}
          </section>
        </>
      )}
    </main>
  )
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
