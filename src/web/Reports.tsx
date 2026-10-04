import { Download, LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CatIcon } from '../components/ui'
import { category, useCustomCategories } from '../lib/categories'
import { money } from '../lib/format'
import { createReportCsv } from '../lib/reportCsv'
import { currencyAtom, totals, useAtom, useSelectedPeriod, useTransactions } from '../lib/store'
import { PeriodControl } from './WebShell'

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** The phone's Stats, side by side, with the same PDF / CSV exports. */
export function Reports() {
  useCustomCategories()
  const all = useTransactions()
  const [symbol] = useAtom(currencyAtom)
  const sel = useSelectedPeriod()
  const transactions = useMemo(() => sel.select(all), [all, sel.period, sel.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const label = sel.label
  const filename = `MeMoney-${sel.period}-${sel.key}.pdf`
  const [making, setMaking] = useState(false)
  const [error, setError] = useState('')
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

  function pdf() {
    if (making) return
    setMaking(true)
    setError('')
    void import('../lib/reportPdf').then(({ createReportPdf }) => createReportPdf(label, filename, transactions, symbol))
      .then(download, () => setError('Could not prepare the PDF. Try again.'))
      .finally(() => setMaking(false))
  }

  return (
    <div className="wd-page">
      <header className="wd-top">
        <h1>Reports</h1>
        <PeriodControl />
        <button className="wd-btn" disabled={!transactions.length} onClick={() => download(createReportCsv(filename.replace(/\.pdf$/i, '.csv'), transactions, symbol))}><Download size={20} />Download CSV</button>
        <button className="wd-btn primary" disabled={!transactions.length || making} onClick={pdf}>
          {making ? <LoaderCircle size={20} className="spin" /> : <Download size={20} />}{making ? 'Preparing PDF…' : 'Download PDF'}</button>
      </header>
      {error && <div className="warn wd-notice" role="alert">{error}</div>}
      <div className="wd-body wd-rp">
        <section className="card wd-rcard" aria-label="Income and spending summary">
          <h2>Total income</h2>
          <div className="wd-big num inc">{money(income, symbol)}</div>
          <div className="wd-stack" aria-hidden="true">
            {incomeRows.map(([id, amount]) => <i key={id} style={{ width: `${(amount / income) * 100}%`, background: category(id).color }} />)}
          </div>
          {incomeRows.length ? (
            <div className="wd-legend">
              {incomeRows.map(([id, amount]) => <div className="wd-lg" key={id}>
                <span title={category(id).label}><i style={{ background: category(id).color }} />{category(id).label}</span>
                <span className="num">{money(amount, symbol)}</span>
                <small>{Math.round((amount / income) * 100)}% of income</small>
              </div>)}
            </div>
          ) : <p className="muted">No income this period</p>}
          <div className="wd-metrics">
            <div><span>Expense</span><b className="num">{money(expense, symbol)}</b><small>{percentOfIncome(expense)}</small></div>
            <div><span>Remaining</span><b className={`num ${balance < 0 ? 'exp' : ''}`}>{balance < 0 ? `−${money(-balance, symbol)}` : money(balance, symbol)}</b><small>{percentOfIncome(balance)}</small></div>
          </div>
        </section>
        <section className="card wd-rcard" aria-label="Expense by category">
          <div className="wd-ehead"><h2>Expense by category</h2><span className="num muted">{money(expense, symbol)}</span></div>
          {expenseRows.length ? <div>
            {expenseRows.map(([id, amount]) => (
              <div key={id} className="wd-erow">
                <CatIcon id={id} size={18} />
                <span>{category(id).label} <small className="muted">{Math.round((amount / expense) * 100)}%</small></span>
                <span className="num">{money(amount, symbol)}</span>
                <div className="bar"><i style={{ width: `${(amount / maxExpense) * 100}%`, background: category(id).color }} /></div>
              </div>
            ))}
          </div> : <p className="muted">No expenses this period</p>}
        </section>
      </div>
    </div>
  )
}
