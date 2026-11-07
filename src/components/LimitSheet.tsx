import { Delete, X } from 'lucide-react'
import { useState } from 'react'
import { Modal } from './Modal'
import { useDragClose } from '../hooks/useDragClose'
import { category } from '../lib/categories'
import { amountToInput, groupInput, money, parseAmount } from '../lib/format'
import { settingsRepo } from '../lib/settings'

/** Set, change or remove one category's monthly spending limit. */
export function LimitSheet({ id, limit, spent, monthLabel, symbol, onClose }: {
  id: string; limit?: number; spent: number; monthLabel: string; symbol: string; onClose: () => void
}) {
  const [input, setInput] = useState(limit ? amountToInput(limit) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const drag = useDragClose(onClose, saving)
  const amount = parseAmount(input)
  const label = category(id).label

  function press(k: string) {
    setError('')
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
  async function save(next: number | null) {
    if (saving) return
    setSaving(true)
    try {
      await settingsRepo.setBudget(id, next)
      onClose()
    } catch {
      setError('Could not save the limit. Try again.')
      setSaving(false)
    }
  }

  return (
    <Modal onDismiss={onClose} busy={saving} className="currency-sheet limit-sheet" aria-labelledby="limit-title">
      <div className="modal-handle" {...drag}>
        <div className="grab" aria-hidden />
        <div className="currency-head"><h2 id="limit-title">{label} · monthly limit</h2><button aria-label="Close limit" disabled={saving} onClick={onClose}><X size={20} /></button></div>
      </div>
      <div className={`num limit-amount${input ? '' : ' empty'}`} aria-live="polite">{symbol}{input ? groupInput(input) : '0'}</div>
      <div className="limit-hint">Spent {money(spent, symbol)} so far in {monthLabel}</div>
      {error && <div className="warn" role="alert">{error}</div>}
      <div className="keys">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map((k) => <button key={k} className="key" disabled={saving} onClick={() => press(k)}>{k}</button>)}
        <button className="key del" aria-label="Backspace" disabled={saving} onClick={() => press('del')}><Delete size={24} /></button>
      </div>
      <div className="limit-actions">
        {limit !== undefined && <button className="limit-remove" disabled={saving} onClick={() => void save(null)}>Remove</button>}
        <button className="save" disabled={saving || amount <= 0 || amount === limit} onClick={() => void save(amount)}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  )
}
