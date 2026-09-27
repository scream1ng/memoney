import { useState } from 'react'
import { CatIcon, MonthSwitch, TypeToggle } from '../components/ui'
import { category } from '../lib/categories'
import { money } from '../lib/format'
import { currencyAtom, forMonth, monthAtom, useAtom, useTransactions } from '../lib/store'
import type { TxType } from '../lib/types'
import { Empty } from './Home'

export function Stats() {
  const all = useTransactions()
  const [month] = useAtom(monthAtom)
  const [symbol] = useAtom(currencyAtom)
  const [type, setType] = useState<TxType>('expense')

  const sums = new Map<string, number>()
  for (const t of forMonth(all, month)) if (t.type === type) sums.set(t.category, (sums.get(t.category) ?? 0) + t.amount)
  const rows = [...sums].sort((a, b) => b[1] - a[1])
  const total = rows.reduce((s, [, v]) => s + v, 0)
  const max = rows[0]?.[1] ?? 1

  return (
    <main className="screen">
      <MonthSwitch />
      <div className="filter"><TypeToggle value={type} onChange={setType} /></div>
      <div className="num total" aria-label="Total">{money(total, symbol)}</div>
      {rows.length ? (
        <section className="card bars">
          {rows.map(([id, v]) => (
            <div key={id} className="row">
              <CatIcon id={id} />
              <div className="grow">
                <div className="row between">
                  <span className="muted">{Math.round((v / total) * 100)}%</span>
                  <span className="num">{money(v, symbol)}</span>
                </div>
                <div className="bar"><i style={{ width: `${(v / max) * 100}%`, background: category(id).color }} /></div>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <Empty />
      )}
    </main>
  )
}
