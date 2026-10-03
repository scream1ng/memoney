import { ChevronRight, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ACTIVE_CATEGORIES, COLORS, ICONS, categoryRepo, useCustomCategories } from '../lib/categories'
import type { TxType } from '../lib/types'
import { CategoryModal, type Draft } from '../screens/Categories'

/** Expense and Income side by side; adding or editing uses the phone's category dialog. */
export function WebCategories() {
  const custom = useCustomCategories()
  const [draft, setDraft] = useState<Draft>()
  const [pending, setPending] = useState(false)
  const [deleteReady, setDeleteReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    categoryRepo.load().catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [loadAttempt])

  function open(next: Draft) { setDraft(next); setDeleteReady(false); setError('') }
  function close() { setDraft(undefined); setDeleteReady(false); setError('') }

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
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.')
      setDeleteReady(false)
    } finally { setPending(false) }
  }

  const column = (type: TxType, title: string) => {
    const mine = custom.filter((c) => c.type === type)
    return (
      <section className="card wd-ccol" aria-label={`${title} categories`}>
        <div className="wd-ccol-head"><h2>{title}</h2>
          <button className="wd-btn" onClick={() => open({ type, label: '', icon: type === 'income' ? 'briefcase' : 'bag', color: type === 'income' ? COLORS[0] : COLORS[3], clues: '' })}>
            <Plus size={18} />Add</button></div>
        <h3>Built in</h3>
        {ACTIVE_CATEGORIES[type].map((c) => <div className="wd-crow" key={c.id}><span className="cat" style={{ background: c.color }}><c.icon size={20} /></span>{c.label}</div>)}
        <h3>Your categories</h3>
        {mine.map((c) => {
          const Icon = ICONS[c.icon] ?? ICONS.briefcase
          return <button className="wd-crow" key={c.id} onClick={() => open(c)}>
            <span className="cat" style={{ background: c.color }}><Icon size={20} /></span><span className="grow">{c.label}</span><ChevronRight size={16} className="muted" />
          </button>
        })}
        {loading && <div className="wd-crow muted">Loading…</div>}
        {!loading && loadError && <div className="wd-crow muted">Could not load your categories.
          <button className="wd-link" onClick={() => { setLoading(true); setLoadError(false); setLoadAttempt((n) => n + 1) }}>Try again</button></div>}
        {!loading && !loadError && !mine.length && <div className="wd-crow muted">None yet</div>}
      </section>
    )
  }

  return (
    <div className="wd-page">
      <header className="wd-top"><h1>Categories</h1></header>
      {error && !draft && <div className="warn wd-notice" role="alert">{error}</div>}
      <div className="wd-body wd-cols">{column('expense', 'Expense')}{column('income', 'Income')}</div>
      {draft && <CategoryModal draft={draft} pending={pending} error={error} deleteReady={deleteReady}
        onChange={(next) => { setDraft(next); setError(''); setDeleteReady(false) }} onClose={close} onSave={save}
        onDelete={() => deleteReady ? void remove(draft.id!) : setDeleteReady(true)} />}
    </div>
  )
}
