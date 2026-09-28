import { ArrowDown, List, Minus, Plus, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MonthSwitch, TxList } from '../components/ui'
import { money } from '../lib/format'
import { currencyAtom, forMonth, monthAtom, repo, totals, useAtom, useTransactions } from '../lib/store'
import type { Tx, TxType } from '../lib/types'

const UNDO_MS = 5_000

export function Home() {
  const all = useTransactions()
  const [month] = useAtom(monthAtom)
  const [symbol] = useAtom(currencyAtom)
  const [filter, setFilter] = useState<TxType | 'all'>('all')
  const undo = useUndoDelete()
  const monthTxs = forMonth(all.filter((x) => x.id !== undo.hidden?.id), month)
  const t = totals(monthTxs)
  const txs = monthTxs.filter((x) => filter === 'all' || x.type === filter)

  return (
    <main className="screen">
      <MonthSwitch />
      <section className="summary">
        <div className={`num balance ${t.balance < 0 ? 'exp' : ''}`} aria-label="Balance">{money(t.balance, symbol)}</div>
        <div className="io">
          <span className="num inc" aria-label="Income">+{money(t.income, symbol)}</span>
          <span className="num exp" aria-label="Expense">−{money(t.expense, symbol)}</span>
        </div>
      </section>
      <div className="seg filter" role="group">
        <button className="n" aria-label="All" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}><List size={18} /></button>
        <button className="e" aria-label="Expense" aria-pressed={filter === 'expense'} onClick={() => setFilter('expense')}><Minus size={18} strokeWidth={2.6} /></button>
        <button className="i" aria-label="Income" aria-pressed={filter === 'income'} onClick={() => setFilter('income')}><Plus size={18} strokeWidth={2.6} /></button>
      </div>
      {txs.length ? <TxList txs={txs} onDelete={undo.remove} /> : <Empty />}
      {undo.hidden && (
        <div className="glass undo" role="status">
          <span>Transaction deleted</span>
          <button onClick={undo.restore}>Undo</button>
        </div>
      )}
    </main>
  )
}

export function Empty() {
  return (
    <div className="empty">
      <div className="big"><Wallet size={40} /></div>
      <ArrowDown size={26} className="bob" aria-hidden />
    </div>
  )
}

/** Hides a deleted row for a few seconds and only then deletes it on the server, so Undo never races the DELETE. */
function useUndoDelete() {
  const [hidden, setHidden] = useState<Tx>()
  const pending = useRef<{ tx: Tx; timer: ReturnType<typeof setTimeout> }>(null)
  const commit = () => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    repo.remove(p.tx.id)
  }
  useEffect(() => {
    window.addEventListener('pagehide', commit)
    return () => {
      window.removeEventListener('pagehide', commit)
      commit()
    }
  }, [])
  return {
    hidden,
    remove(tx: Tx) {
      commit()
      pending.current = { tx, timer: setTimeout(() => { commit(); setHidden(undefined) }, UNDO_MS) }
      setHidden(tx)
    },
    restore() {
      if (pending.current) clearTimeout(pending.current.timer)
      pending.current = null
      setHidden(undefined)
    },
  }
}
