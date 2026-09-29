import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORIES, COLORS, ICONS, categoryRepo, useCustomCategories } from '../lib/categories'
import type { CustomCategory, TxType } from '../lib/types'

type Draft = Omit<CustomCategory, 'id'> & { id?: string }

export function Categories() {
  const navigate = useNavigate()
  const custom = useCustomCategories()
  const [type, setType] = useState<TxType>('income')
  const [draft, setDraft] = useState<Draft>()
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
    setDeleteReady(false)
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft || pending) return
    const label = draft.label.trim()
    const clues = draft.clues.trim()
    if (!label) return setError('Enter a category name.')
    const names = [...custom.filter((c) => c.type === draft.type && c.id !== draft.id), ...CATEGORIES[draft.type]]
    if (names.some((c) => c.label.toLocaleLowerCase() === label.toLocaleLowerCase())) return setError('This category name already exists.')
    setPending(true)
    setError('')
    try {
      await categoryRepo.save({ type: draft.type, label, icon: draft.icon, color: draft.color, clues }, draft.id)
      setType(draft.type)
      setDraft(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save category.')
    } finally { setPending(false) }
  }

  async function remove() {
    if (!draft?.id || pending) return
    if (!deleteReady) return setDeleteReady(true)
    setPending(true)
    setError('')
    try {
      await categoryRepo.remove(draft.id)
      setDraft(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.')
      setDeleteReady(false)
    } finally { setPending(false) }
  }

  return (
    <main className="screen category-screen">
      <button className="category-back" onClick={() => draft ? openList() : navigate('/settings')}>
        <ChevronLeft size={20} />{draft ? 'Categories' : 'Settings'}
      </button>
      <h1>{draft ? draft.id ? 'Edit category' : 'New category' : 'Categories'}</h1>
      {draft ? (
        <form className="category-form" onSubmit={save}>
          <label className="category-field-label" htmlFor="category-type">DETAILS</label>
          <div className="card category-fields">
            <label className="category-field">Type
              <select id="category-type" value={draft.type} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, type: e.target.value as TxType })}>
                <option value="income">Income</option><option value="expense">Expense</option>
              </select>
            </label>
            <label className="category-field">Name
              <input value={draft.label} maxLength={40} placeholder={draft.type === 'income' ? 'Salary · Main job' : 'Work travel'}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })} autoFocus />
            </label>
          </div>
          <div className="category-field-label">ICON</div>
          <div className="category-choices" role="group" aria-label="Icon">
            {Object.entries(ICONS).map(([name, Icon]) => (
              <button type="button" key={name} aria-label={name} aria-pressed={draft.icon === name} onClick={() => setDraft({ ...draft, icon: name })}>
                <Icon size={22} />
              </button>
            ))}
          </div>
          <div className="category-field-label">COLOR</div>
          <div className="category-choices colors" role="group" aria-label="Color">
            {COLORS.map((color) => (
              <button type="button" key={color} aria-label={color} aria-pressed={draft.color === color} style={{ background: color }} onClick={() => setDraft({ ...draft, color })} />
            ))}
          </div>
          <label className="category-field-label" htmlFor="category-clues">HELP AI RECOGNIZE IT · OPTIONAL</label>
          <textarea id="category-clues" className="category-clues" value={draft.clues} maxLength={200}
            placeholder={draft.type === 'income' ? 'Payer name, words you might say' : 'Merchant name, words on the receipt'}
            onChange={(e) => setDraft({ ...draft, clues: e.target.value })} />
          <p className="category-help">AI uses these clues to suggest this category when adding an entry.</p>
          {error && <div className="warn" role="alert">{error}</div>}
          <button className="review-save" type="submit" disabled={pending || !draft.label.trim()}>{pending ? 'Saving…' : 'Save category'}</button>
          {draft.id && <button className="category-delete" type="button" disabled={pending} onClick={() => void remove()}><Trash2 size={18} />{deleteReady ? 'Confirm delete' : 'Delete category'}</button>}
        </form>
      ) : (
        <>
          <div className="seg category-type" role="group" aria-label="Category type">
            <button className="e" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>Expense</button>
            <button className="i" aria-pressed={type === 'income'} onClick={() => setType('income')}>Income</button>
          </div>
          {error && <div className="warn" role="alert">{error}</div>}
          <div className="category-field-label">YOUR CATEGORIES</div>
          <section className="card category-list">
            {custom.filter((c) => c.type === type).map((c) => {
              const Icon = ICONS[c.icon]
              return <button className="category-item" key={c.id} onClick={() => open(c)}>
                <span className="cat" style={{ background: c.color }}>{Icon && <Icon size={22} />}</span>
                <span className="category-item-text"><strong>{c.label}</strong>{c.clues && <small>{c.clues}</small>}</span><ChevronRight size={18} />
              </button>
            })}
            {loading && <div className="category-item muted">Loading…</div>}
            <button className="category-item add" onClick={() => open({ type, label: '', icon: type === 'income' ? 'briefcase' : 'receipt', color: type === 'income' ? COLORS[0] : COLORS[3], clues: '' })}>
              <span className="cat"><Plus size={22} /></span>Add category
            </button>
          </section>
          <div className="category-field-label">BUILT IN</div>
          <section className="card category-list">
            {CATEGORIES[type].map((c) => <div className="category-item" key={c.id}>
              <span className="cat" style={{ background: c.color }}><c.icon size={22} /></span><span>{c.label}</span>
            </div>)}
          </section>
        </>
      )}
    </main>
  )

  function openList() { setDraft(undefined); setDeleteReady(false); setError('') }
}
