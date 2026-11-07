import { ArrowDown, ChevronLeft, ChevronRight, List, Minus, Plus, RefreshCw, Search, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PeriodToggle, TxList } from '../components/ui'
import { usePeriodSwipe } from '../hooks/usePeriodSwipe'
import { usePullRefresh } from '../hooks/usePullRefresh'
import { useCustomCategories } from '../lib/categories'
import { money } from '../lib/format'
import { currencyAtom, deleteFailureAtom, repo, search, totals, useAtom, useSelectedPeriod, useTransactions } from '../lib/store'
import { refreshAll } from '../lib/sync'
import type { Tx, TxType } from '../lib/types'

const UNDO_MS = 5_000

export function Home() {
  const all = useTransactions()
  const navigate = useNavigate()
  const location = useLocation()
  const [symbol] = useAtom(currencyAtom)
  const [filter, setFilter] = useState<TxType | 'all'>('all')
  const sel = useSelectedPeriod()
  const undo = useUndoDelete()
  const swipe = usePeriodSwipe(sel.shift)
  const { indicator: pullRef, refreshing } = usePullRefresh(() => refreshAll(true))
  const [query, setQuery] = useState<string>() // undefined: not searching
  const visible = all.filter((x) => x.id !== undo.hidden?.id)
  const periodTxs = sel.select(visible)
  const t = totals(periodTxs)
  const txs = periodTxs.filter((x) => filter === 'all' || x.type === filter)
  const pullSpinner = <div className={`ptr${refreshing ? ' spinning' : ''}`} ref={pullRef} aria-hidden><RefreshCw size={20} /></div>

  if (query !== undefined) return <main className="screen">{pullSpinner}<SearchResults query={query} setQuery={setQuery} txs={visible} onDelete={undo.remove} />{undo.hidden && <UndoBar undo={undo} />}</main>

  return (
    <main className="screen">
      {pullSpinner}
      <div className="period-swipe" {...swipe.handlers}>
        <div className={`row between month${sel.period === 'week' ? ' week' : ''}`}>
          <h1>{sel.title}</h1>
          <div className="row">
            <button className="icon-btn" aria-label="Search entries" onClick={() => setQuery('')}><Search size={20} /></button>
            <button className="icon-btn" aria-label={`Previous ${sel.period}`} onClick={() => swipe.go(-1)}><ChevronLeft size={20} /></button>
            <button className="icon-btn" aria-label={`Next ${sel.period}`} onClick={() => swipe.go(1)}><ChevronRight size={20} /></button>
          </div>
        </div>
        <section className={`summary ${swipe.slide}`} key={sel.key}>
          <div className={`num balance ${t.balance < 0 ? 'exp' : ''}`} aria-label="Balance">{t.balance < 0 ? `−${money(-t.balance, symbol)}` : money(t.balance, symbol)}</div>
          <div className="io">
            <span className="num inc" aria-label="Income">+{money(t.income, symbol)}</span>
            <span className="num exp" aria-label="Expense">−{money(t.expense, symbol)}</span>
          </div>
        </section>
      </div>
      <div className="row between period-controls">
        <div className="seg filter" role="group" aria-label="Transaction type">
          <button className="n" aria-label="All" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}><List size={18} /></button>
          <button className="e" aria-label="Expense" aria-pressed={filter === 'expense'} onClick={() => setFilter('expense')}><Minus size={18} strokeWidth={2.6} /></button>
          <button className="i" aria-label="Income" aria-pressed={filter === 'income'} onClick={() => setFilter('income')}><Plus size={18} strokeWidth={2.6} /></button>
        </div>
        <PeriodToggle value={sel.period} onChange={sel.setPeriod} />
      </div>
      {txs.length ? <TxList txs={txs} onDelete={undo.remove} /> : <Empty
        message={periodTxs.length ? `No ${filter} entries in this period.` : `No transactions for ${sel.title}.`}
        onAdd={() => navigate('/add', { state: { bg: location } })}
        onClear={periodTxs.length ? () => setFilter('all') : undefined} />}
      {undo.hidden && <UndoBar undo={undo} />}
    </main>
  )
}

function UndoBar({ undo }: { undo: ReturnType<typeof useUndoDelete> }) {
  return (
    <div className="glass undo" role="status">
      <span>{undo.deleting ? 'Deleting entry…' : 'Entry ready to delete'}</span>
      <button disabled={undo.deleting} onClick={undo.restore}>Undo</button>
    </div>
  )
}

/** Replaces the header and totals while searching; matches every entry ever, not just the selected period. */
function SearchResults({ query, setQuery, txs, onDelete }: { query: string; setQuery: (q: string | undefined) => void; txs: Tx[]; onDelete: (tx: Tx) => void }) {
  useCustomCategories() // category names are searchable
  const [symbol] = useAtom(currencyAtom)
  const found = useMemo(() => search(txs, query), [txs, query])
  const { balance } = totals(found)
  return <>
    <div className="search-head">
      <label className="search-field"><Search size={18} aria-hidden />
        <input type="search" autoFocus enterKeyHint="search" placeholder="Search notes or shops" aria-label="Search notes or shops" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <button className="search-cancel" onClick={() => setQuery(undefined)}>Cancel</button>
    </div>
    {query.trim() && <div className="search-sum" role="status">
      <span>{found.length === 1 ? '1 entry' : `${found.length} entries`} · all time</span>
      {!!found.length && <span className="num">{balance < 0 ? `−${money(-balance, symbol)}` : `+${money(balance, symbol)}`}</span>}
    </div>}
    {found.length ? <TxList txs={found} onDelete={onDelete} /> : query.trim() ? <p className="muted search-none">No entries match “{query.trim()}”.</p> : null}
  </>
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
