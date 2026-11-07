import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CatIcon, PeriodToggle } from '../components/ui'
import { LimitSheet } from '../components/LimitSheet'
import { ReportExportSheet } from '../components/ReportExportSheet'
import { usePeriodSwipe } from '../hooks/usePeriodSwipe'
import { category, useCustomCategories } from '../lib/categories'
import { fromDateKey, money } from '../lib/format'
import { useBudgets } from '../lib/settings'
import { currencyAtom, inRange, previousRange, totals, useAtom, useSelectedPeriod, useTransactions } from '../lib/store'
import type { Tx } from '../lib/types'

const expenseByCategory = (txs: Tx[]) => {
  const sums = new Map<string, number>()
  for (const tx of txs) if (tx.type === 'expense') sums.set(tx.category, (sums.get(tx.category) ?? 0) + tx.amount)
  return sums
}

/** ↑ 12% when spending went up (red), ↓ when down (green); nothing when there's no earlier spending to compare with. */
function Delta({ now, before, label }: { now: number; before: number; label?: string }) {
  if (!before) return null
  const pct = Math.round(((now - before) / before) * 100)
  const vs = label ? <span className="delta-vs">vs {label}</span> : null
  if (!pct) return <span className="delta">same{vs}</span>
  const Icon = pct > 0 ? ArrowUp : ArrowDown
  return <span className={`delta ${pct > 0 ? 'up' : 'down'}`} aria-label={`${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}%${label ? ` vs ${label}` : ''}`}>
    <Icon size={12} strokeWidth={2.8} aria-hidden />{Math.abs(pct)}%{vs}
  </span>
}

export function Stats({ exportOpen, onCloseExport }: { exportOpen: boolean; onCloseExport: () => void }) {
  useCustomCategories()
  const all = useTransactions()
  const budgets = useBudgets()
  const [symbol] = useAtom(currencyAtom)
  const sel = useSelectedPeriod()
  const swipe = usePeriodSwipe(sel.shift)
  const [editing, setEditing] = useState<string>()
  const transactions = useMemo(() => sel.select(all), [all, sel.period, sel.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => previousRange(sel.period, sel.key), [sel.period, sel.key])
  const before = useMemo(() => inRange(all, prev), [all, prev])
  const { income, expense, balance } = totals(transactions)
  const incomeSums = new Map<string, number>()
  for (const tx of transactions) if (tx.type === 'income') incomeSums.set(tx.category, (incomeSums.get(tx.category) ?? 0) + tx.amount)
  const expenseSums = expenseByCategory(transactions)
  const beforeSums = expenseByCategory(before)
  // limits are monthly, so they only show in Month view; a limited category shows even before anything is spent
  const monthly = sel.period === 'month'
  if (monthly) for (const id of Object.keys(budgets)) if (!expenseSums.has(id)) expenseSums.set(id, 0)
  const incomeRows = [...incomeSums].sort((a, b) => b[1] - a[1])
  const expenseRows = [...expenseSums].sort((a, b) => b[1] - a[1])
  const maxExpense = expenseRows[0]?.[1] || 1
  const percentOfIncome = (amount: number) => income > 0 ? `${Math.round((amount / income) * 100)}% of income` : '—'
  const monthName = fromDateKey(`${sel.key}-01`).toLocaleDateString(undefined, { month: 'long' })

  return (
    <main className="screen">
      <div className="period-swipe" {...swipe.handlers}>
        <div className={`row between month${sel.period === 'week' ? ' week' : ''}`}>
          <h1>{sel.title}</h1>
          <div className="row">
            <button className="icon-btn" aria-label={`Previous ${sel.period}`} onClick={() => swipe.go(-1)}><ChevronLeft size={20} /></button>
            <button className="icon-btn" aria-label={`Next ${sel.period}`} onClick={() => swipe.go(1)}><ChevronRight size={20} /></button>
          </div>
        </div>
        <section className="card stats-summary" aria-label="Income and spending summary">
          <div className="stats-summary-top">
            <div className={`stats-summary-headline ${swipe.slide}`} key={sel.key}><span className="stats-summary-kicker">TOTAL INCOME</span><span className="num stats-summary-amount">{money(income, symbol)}</span></div>
            <PeriodToggle value={sel.period} onChange={sel.setPeriod} />
          </div>
          <div className="stats-income-bar" aria-hidden="true">
            {incomeRows.map(([id, amount]) => <span key={id} style={{ width: `${(amount / income) * 100}%`, background: category(id).color }} />)}
          </div>
          {incomeRows.length ? (
            <div className="stats-income-legend">
              {incomeRows.map(([id, amount]) => <div className="stats-income-legend-item" key={id}>
                <span className="stats-income-legend-name" title={category(id).label}><i style={{ background: category(id).color }} />{category(id).label}</span>
                <span className="num">{money(amount, symbol)}</span>
                <small>{Math.round((amount / income) * 100)}% of income</small>
              </div>)}
            </div>
          ) : <div className="muted stats-income-empty">No income this period</div>}
          <div className="stats-summary-metrics">
            <div><span className="muted">Expense</span><span className="num">{money(expense, symbol)}</span><small>{percentOfIncome(expense)}</small>
              <Delta now={expense} before={totals(before).expense} label={prev.label} /></div>
            <div><span className="muted">Remaining</span><span className={`num ${balance < 0 ? 'exp' : ''}`}>{balance < 0 ? `−${money(-balance, symbol)}` : money(balance, symbol)}</span><small>{percentOfIncome(balance)}</small></div>
          </div>
        </section>
      </div>
      <h2 className="stats-breakdown-title">Expense by category</h2>
      {expenseRows.length ? (
        <section className="card bars">
          {expenseRows.map(([id, amount]) => {
            const limit = monthly ? budgets[id] : undefined
            const over = limit !== undefined && amount > limit
            const width = limit !== undefined ? Math.min(amount / limit, 1) : amount / maxExpense
            const body = <>
              <CatIcon id={id} />
              <div className="grow">
                <div className="row between">
                  <span>{category(id).label} <Delta now={amount} before={beforeSums.get(id) ?? 0} /></span>
                  <span className="num">{money(amount, symbol)}</span>
                </div>
                <div className="bar"><i className={over ? 'over' : undefined} style={{ width: `${width * 100}%`, background: over ? undefined : category(id).color }} /></div>
                {monthly && <div className={`limit-line${over ? ' over' : ''}`}>
                  {limit === undefined ? 'No limit · tap to set'
                    : over ? `${money(amount - limit, symbol)} over ${money(limit, symbol)}`
                    : `${money(limit - amount, symbol)} left of ${money(limit, symbol)}`}
                </div>}
              </div>
            </>
            return monthly
              ? <button key={id} className="row bar-row" onClick={() => setEditing(id)}>{body}</button>
              : <div key={id} className="row">{body}</div>
          })}
        </section>
      ) : (
        <div className="card stats-empty">No expenses this period</div>
      )}
      {editing && <LimitSheet id={editing} limit={budgets[editing]} spent={expenseSums.get(editing) ?? 0} monthLabel={monthName} symbol={symbol} onClose={() => setEditing(undefined)} />}
      {exportOpen && <ReportExportSheet label={sel.label} filename={`MeMoney-${sel.period}-${sel.key}.pdf`} transactions={transactions} symbol={symbol} onClose={onCloseExport} />}
    </main>
  )
}
