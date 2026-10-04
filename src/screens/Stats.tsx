import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { CatIcon, PeriodToggle } from '../components/ui'
import { ReportExportSheet } from '../components/ReportExportSheet'
import { category, useCustomCategories } from '../lib/categories'
import { money } from '../lib/format'
import { currencyAtom, totals, useAtom, useSelectedPeriod, useTransactions } from '../lib/store'

export function Stats({ exportOpen, onCloseExport }: { exportOpen: boolean; onCloseExport: () => void }) {
  useCustomCategories()
  const all = useTransactions()
  const [symbol] = useAtom(currencyAtom)
  const sel = useSelectedPeriod()
  const transactions = useMemo(() => sel.select(all), [all, sel.period, sel.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const { income, expense, balance } = totals(transactions)
  const incomeSums = new Map<string, number>()
  const expenseSums = new Map<string, number>()
  for (const tx of transactions) {
    const sums = tx.type === 'income' ? incomeSums : expenseSums
    sums.set(tx.category, (sums.get(tx.category) ?? 0) + tx.amount)
  }
  const incomeRows = [...incomeSums].sort((a, b) => b[1] - a[1])
  const expenseRows = [...expenseSums].sort((a, b) => b[1] - a[1])
  const maxExpense = expenseRows[0]?.[1] ?? 1
  const percentOfIncome = (amount: number) => income > 0 ? `${Math.round((amount / income) * 100)}% of income` : '—'

  return (
    <main className="screen">
      <div className={`row between month${sel.period === 'week' ? ' week' : ''}`}>
        <h1>{sel.title}</h1>
        <div className="row">
          <button className="icon-btn" aria-label={`Previous ${sel.period}`} onClick={() => sel.shift(-1)}><ChevronLeft size={20} /></button>
          <button className="icon-btn" aria-label={`Next ${sel.period}`} onClick={() => sel.shift(1)}><ChevronRight size={20} /></button>
        </div>
      </div>
      <section className="card stats-summary" aria-label="Income and spending summary">
        <div className="stats-summary-top">
          <div className="stats-summary-headline"><span className="stats-summary-kicker">TOTAL INCOME</span><span className="num stats-summary-amount">{money(income, symbol)}</span></div>
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
          <div><span className="muted">Expense</span><span className="num">{money(expense, symbol)}</span><small>{percentOfIncome(expense)}</small></div>
          <div><span className="muted">Remaining</span><span className={`num ${balance < 0 ? 'exp' : ''}`}>{balance < 0 ? `−${money(-balance, symbol)}` : money(balance, symbol)}</span><small>{percentOfIncome(balance)}</small></div>
        </div>
      </section>
      <h2 className="stats-breakdown-title">Expense by category</h2>
      {expenseRows.length ? (
        <section className="card bars">
          {expenseRows.map(([id, amount]) => (
            <div key={id} className="row">
              <CatIcon id={id} />
              <div className="grow">
                <div className="row between">
                  <span>{category(id).label} <small className="muted">{Math.round((amount / expense) * 100)}%</small></span>
                  <span className="num">{money(amount, symbol)}</span>
                </div>
                <div className="bar"><i style={{ width: `${(amount / maxExpense) * 100}%`, background: category(id).color }} /></div>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="card stats-empty">No expenses this period</div>
      )}
      {exportOpen && <ReportExportSheet label={sel.label} filename={`MeMoney-${sel.period}-${sel.key}.pdf`} transactions={transactions} symbol={symbol} onClose={onCloseExport} />}
    </main>
  )
}
