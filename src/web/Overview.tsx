import { List, Minus, Paperclip, Plus, Search, Upload as UploadIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router-dom'
import { CatIcon } from '../components/ui'
import { category, useCustomCategories } from '../lib/categories'
import { fromDateKey, money, monthLabel, weekLabel } from '../lib/format'
import { currencyAtom, forMonth, forWeek, monthAtom, periodAtom, totals, useAtom, useTransactions, weekAtom } from '../lib/store'
import type { TxType } from '../lib/types'
import { addFiles, pending, showReview, useUploads } from './uploads'
import { PeriodControl } from './WebShell'

const shortDate = (key: string) => fromDateKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const signed = (n: number, symbol: string) => (n < 0 ? `−${money(-n, symbol)}` : money(n, symbol))

/** `selected` is the entry open in the panel; the page itself is rendered at the panel's background location. */
export function Overview({ selected }: { selected?: string }) {
  useCustomCategories()
  const all = useTransactions()
  const navigate = useNavigate()
  const location = useLocation()
  const matched = useMatch('/tx/:id')?.params.id
  const open = selected ?? matched
  const [symbol] = useAtom(currencyAtom)
  const [period] = useAtom(periodAtom)
  const [month] = useAtom(monthAtom)
  const [week] = useAtom(weekAtom)
  const [filter, setFilter] = useState<TxType | 'all'>('all')
  const [query, setQuery] = useState('')
  const periodTxs = useMemo(() => (period === 'week' ? forWeek(all, week) : forMonth(all, month)), [all, period, week, month])
  const { income, expense, balance } = totals(periodTxs)
  const q = query.trim().toLowerCase()
  const rows = periodTxs.filter((t) => (filter === 'all' || t.type === filter) &&
    (!q || [t.note, t.merchant, category(t.category).label].some((s) => s?.toLowerCase().includes(q))))
  const pct = (n: number) => (income > 0 ? `${Math.round((n / income) * 100)}% of income` : '—')
  const incomeCount = periodTxs.filter((t) => t.type === 'income').length
  const label = period === 'week' ? weekLabel(week) : monthLabel(month)
  const toCheck = useUploads().filter(pending).length
  const edit = (id: string) => navigate(`/tx/${id}`, { state: { bg: location.state?.bg ?? location } })

  return (
    <div className="wd-page">
      <header className="wd-top">
        <h1>Overview</h1>
        {!!toCheck && <button className="wd-pill" onClick={showReview}><i aria-hidden />{toCheck === 1 ? '1 receipt to check' : `${toCheck} receipts to check`}</button>}
        <PeriodControl />
        <button className="wd-btn" onClick={() => navigate('/add', { state: { bg: location } })}><Plus size={20} />New entry</button>
        <AddReceipts className="wd-btn primary"><UploadIcon size={20} />Add receipts</AddReceipts>
      </header>
      <div className="wd-body">
        <div className="wd-kpis">
          <div className="card wd-kpi"><small>Income</small><div className="num inc">{money(income, symbol)}</div><div className="sub">{incomeCount} {incomeCount === 1 ? 'entry' : 'entries'}</div></div>
          <div className="card wd-kpi"><small>Expense</small><div className="num">{money(expense, symbol)}</div><div className="sub">{pct(expense)}</div></div>
          <div className="card wd-kpi"><small>Remaining</small><div className={`num ${balance < 0 ? 'exp' : ''}`}>{signed(balance, symbol)}</div><div className="sub">{pct(balance)}</div></div>
        </div>
        <section className="card wd-table">
          <div className="wd-table-head">
            <label className="wd-search"><Search size={18} /><input type="search" placeholder="Search notes or shops" aria-label="Search notes or shops" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <div className="seg filter" role="group" aria-label="Transaction type">
              <button className="n" aria-label="All" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}><List size={18} /></button>
              <button className="e" aria-label="Expense" aria-pressed={filter === 'expense'} onClick={() => setFilter('expense')}><Minus size={18} strokeWidth={2.6} /></button>
              <button className="i" aria-label="Income" aria-pressed={filter === 'income'} onClick={() => setFilter('income')}><Plus size={18} strokeWidth={2.6} /></button>
            </div>
          </div>
          {rows.length ? (
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th><span className="sr">Receipt</span></th><th className="amt">Amount</th></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const name = t.merchant || category(t.category).label
                  return (
                    <tr key={t.id} className={open === t.id ? 'sel' : undefined} tabIndex={0} aria-label={`Edit ${name}`}
                      onClick={() => edit(t.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(t.id) } }}>
                      <td className="muted">{shortDate(t.date)}</td>
                      <td><div className="wd-cc"><CatIcon id={t.category} size={18} />{name}</div></td>
                      <td className="muted wd-note">{t.note}</td>
                      <td>{t.photoAt && <Paperclip size={14} className="muted" aria-label="Has receipt" />}</td>
                      <td className={`amt num ${t.type === 'income' ? 'inc' : ''}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount, symbol)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="wd-empty">
              {periodTxs.length ? <>No entries match.<button onClick={() => { setQuery(''); setFilter('all') }}>Show all</button></> : <>No entries for {label}.</>}
            </div>
          )}
          <div className="wd-tip"><UploadIcon size={16} />Tip: drop receipt photos anywhere on this window to add them.</div>
        </section>
      </div>
    </div>
  )
}

/** Opens the file picker; picked receipts open Review receipts. */
export function AddReceipts({ className, children }: { className: string; children: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  return <>
    <button className={className} onClick={() => input.current?.click()}>{children}</button>
    <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => {
      const files = [...(e.target.files ?? [])]
      e.target.value = ''
      if (files.length) addFiles(files)
    }} />
  </>
}
