import type { Ref } from 'react'
import { ACTIVE_CATEGORIES, CATEGORIES, categories, category, useCustomCategories } from '../lib/categories'
import { currencyAtom, useAtom } from '../lib/store'
import type { TxType } from '../lib/types'
import type { Field } from './uploads'

export interface Fields { type: TxType; input: string; date: string; cat?: string; note: string }

/**
 * The desktop entry form, shared by New entry, Edit entry and Review receipts.
 * Its buttons are type="button", so a parent <form> only submits on Enter in a field.
 */
export function EntryForm({ value, hints = [], disabled, onChange, amountRef, children }: {
  value: Fields; hints?: Field[]; disabled?: boolean; onChange: (patch: Partial<Fields>, field: Field) => void
  amountRef?: Ref<HTMLInputElement>; children?: React.ReactNode
}) {
  const [symbol] = useAtom(currencyAtom)
  const custom = useCustomCategories()
  const { type, input, date, cat, note } = value
  const dot = (f: Field) => hints.includes(f) && <span className="hint-mark" aria-label="Guessed" />
  const choices = [...custom.filter((c) => c.type === type).map((c) => category(c.id)), ...ACTIVE_CATEGORIES[type]]
  // an entry saved under a retired category keeps it as a choice
  if (cat && CATEGORIES[type].some((c) => c.id === cat) && !choices.some((c) => c.id === cat)) choices.unshift(category(cat))
  const switchType = (t: TxType) => onChange({ type: t, cat: categories(t).some((c) => c.id === cat) ? cat : undefined }, 'type')

  return (
    <div className="wd-ef">
      <div className={`wd-typeseg${hints.includes('type') ? ' hint-seg' : ''}`} role="group" aria-label="Type">
        <button type="button" className="e" aria-pressed={type === 'expense'} disabled={disabled} onClick={() => switchType('expense')}>Expense</button>
        <button type="button" className="i" aria-pressed={type === 'income'} disabled={disabled} onClick={() => switchType('income')}>Income</button>
      </div>
      <label className="wd-fld">
        <span>Amount {dot('amount')}</span>
        <span className={`wd-in wd-amt num ${type === 'income' ? 'inc' : ''}`}>
          {symbol && <span className="cur">{symbol}</span>}
          <input ref={amountRef} inputMode="decimal" autoComplete="off" placeholder="0" disabled={disabled} value={input}
            onChange={(e) => {
              const v = e.target.value.replace(/,/g, '')
              if (/^\d{0,9}(\.\d{0,2})?$/.test(v)) onChange({ input: v }, 'amount')
            }} />
        </span>
      </label>
      <div className="wd-two">
        <label className="wd-fld">
          <span>Date {dot('date')}</span>
          <span className="wd-in">
            <input type="date" required disabled={disabled} value={date} onChange={(e) => { if (e.target.value) onChange({ date: e.target.value }, 'date') }} /></span>
        </label>
        <label className="wd-fld">
          <span>Note {dot('note')}</span>
          <span className="wd-in"><input value={note} placeholder="Add a note" maxLength={80} disabled={disabled} onChange={(e) => onChange({ note: e.target.value }, 'note')} /></span>
        </label>
      </div>
      <div className="wd-fld">
        <span id="wd-cat-label">Category {dot('cat')}</span>
        <div className="wd-cgrid" role="group" aria-labelledby="wd-cat-label">
          {choices.map((c) => (
            <button type="button" key={c.id} aria-pressed={cat === c.id} disabled={disabled} onClick={() => onChange({ cat: c.id }, 'cat')}>
              <span className="cat" style={{ background: c.color }}><c.icon size={20} /></span>
              <span className="lbl">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
