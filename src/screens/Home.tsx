import { ArrowDown, ChevronLeft, ChevronRight, List, Minus, Plus, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TxList } from '../components/ui'
import { money, monthLabel, shiftMonth, shiftWeek, weekLabel } from '../lib/format'
import { currencyAtom, deleteFailureAtom, forMonth, forWeek, monthAtom, periodAtom, weekAtom, repo, totals, useAtom, useTransactions } from '../lib/store'
import type { Tx, TxType } from '../lib/types'

const UNDO_MS = 5_000

export function Home() {
  const all = useTransactions()
  const navigate = useNavigate()
  const location = useLocation()
  const [month, setMonth] = useAtom(monthAtom)
  const [symbol] = useAtom(currencyAtom)
  const [filter, setFilter] = useState<TxType | 'all'>('all')
  const [period, setPeriod] = useAtom(periodAtom)
  const [week, setWeek] = useAtom(weekAtom)
  const undo = useUndoDelete()
  const visible = all.filter((x) => x.id !== undo.hidden?.id)
  const periodTxs = period === 'week' ? forWeek(visible, week) : forMonth(visible, month)
  const t = totals(periodTxs)
  const txs = periodTxs.filter((x) => filter === 'all' || x.type === filter)

  return (
    <main className="screen">
      <div className={`row between month${period === 'week' ? ' week' : ''}`}>
        <h1>{period === 'week' ? weekLabel(week) : monthLabel(month)}</h1>
        <div className="row">
          <button className="icon-btn" aria-label={period === 'week' ? 'Previous week' : 'Previous month'} onClick={() => period === 'week' ? setWeek(shiftWeek(week, -1)) : setMonth(shiftMonth(month, -1))}><ChevronLeft size={20} /></button>
          <button className="icon-btn" aria-label={period === 'week' ? 'Next week' : 'Next month'} onClick={() => period === 'week' ? setWeek(shiftWeek(week, 1)) : setMonth(shiftMonth(month, 1))}><ChevronRight size={20} /></button>
        </div>
      </div>
      <section className="summary">
        <div className={`num balance ${t.balance < 0 ? 'exp' : ''}`} aria-label="Balance">{t.balance < 0 ? `−${money(-t.balance, symbol)}` : money(t.balance, symbol)}</div>
        <div className="io">
          <span className="num inc" aria-label="Income">+{money(t.income, symbol)}</span>
          <span className="num exp" aria-label="Expense">−{money(t.expense, symbol)}</span>
        </div>
      </section>
      <div className="row between period-controls">
        <div className="seg filter" role="group" aria-label="Transaction type">
          <button className="n" aria-label="All" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}><List size={18} /></button>
          <button className="e" aria-label="Expense" aria-pressed={filter === 'expense'} onClick={() => setFilter('expense')}><Minus size={18} strokeWidth={2.6} /></button>
          <button className="i" aria-label="Income" aria-pressed={filter === 'income'} onClick={() => setFilter('income')}><Plus size={18} strokeWidth={2.6} /></button>
        </div>
        <div className="seg period-toggle" role="group" aria-label="Time period">
          <button aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Week</button>
          <button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>Month</button>
        </div>
      </div>
      {txs.length ? <TxList txs={txs} onDelete={undo.remove} /> : <Empty
        message={periodTxs.length ? `No ${filter} entries in this period.` : `No transactions for ${period === 'week' ? weekLabel(week) : monthLabel(month)}.`}
        onAdd={() => navigate('/add', { state: { bg: location } })}
        onClear={periodTxs.length ? () => setFilter('all') : undefined} />}
      {undo.hidden && (
        <div className="glass undo" role="status">
          <span>{undo.deleting ? 'Deleting entry…' : 'Entry ready to delete'}</span>
          <button disabled={undo.deleting} onClick={undo.restore}>Undo</button>
        </div>
      )}
    </main>
  )
}

export function Empty({ message, onAdd, onClear }: { message: string; onAdd: () => void; onClear?: () => void }) {
  return (
    <div className="empty">
      <div className="big" aria-hidden><Wallet size={40} /></div>
      <p role="status">{message}</p>
      <button className="empty-action" onClick={onClear ?? onAdd}>{onClear ? 'Show all entries' : 'Add entry'}</button>
      <ArrowDown size={26} className="bob" aria-hidden />
    </div>
  )
}

/** Hides a deleted row for a few seconds and only then deletes it on the server, so Undo never races the DELETE. */
function useUndoDelete() {
  const [hidden, setHidden] = useState<Tx>()
  const [deleting, setDeleting] = useState<string>()
  const mounted = useRef(true)
  const pending = useRef<{ tx: Tx; timer: ReturnType<typeof setTimeout> }>(null)
  const commit = () => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    if (mounted.current) setDeleting(p.tx.id)
    void repo.remove(p.tx.id).catch(() => deleteFailureAtom.set(p.tx)).finally(() => {
      if (mounted.current) {
        setHidden((current) => current?.id === p.tx.id ? undefined : current)
        setDeleting((current) => current === p.tx.id ? undefined : current)
      }
    })
  }
  useEffect(() => {
    mounted.current = true
    window.addEventListener('pagehide', commit)
    return () => {
      window.removeEventListener('pagehide', commit)
      mounted.current = false
      commit()
    }
  }, [])
  return {
    hidden,
    deleting: !!deleting && deleting === hidden?.id,
    remove(tx: Tx) {
      commit()
      pending.current = { tx, timer: setTimeout(commit, UNDO_MS) }
      setHidden(tx)
    },
    restore() {
      if (!pending.current) return
      clearTimeout(pending.current.timer)
      pending.current = null
      setHidden(undefined)
    },
  }
}
