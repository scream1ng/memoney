import { ChartPie, ChevronLeft, ChevronRight, House, Plus, Settings } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { category } from '../lib/categories'
import { dayLabel, money, monthLabel, shiftMonth } from '../lib/format'
import { currencyAtom, monthAtom, useAtom } from '../lib/store'
import type { Tx, TxType } from '../lib/types'

export function CatIcon({ id, size = 22 }: { id: string; size?: number }) {
  const c = category(id)
  const Icon = c.icon
  return (
    <span className="cat" style={{ background: c.color }} aria-label={c.label} role="img">
      <Icon size={size} strokeWidth={2} />
    </span>
  )
}

export function MonthSwitch() {
  const [month, setMonth] = useAtom(monthAtom)
  return (
    <div className="row between month">
      <h1>{monthLabel(month)}</h1>
      <div className="row">
        <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={20} />
        </button>
        <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}

export function Dock() {
  const navigate = useNavigate()
  const location = useLocation()
  const tabs = [
    { to: '/', icon: House, label: 'Home' },
    { to: '/stats', icon: ChartPie, label: 'Stats' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]
  return (
    <nav className="dock">
      <div className="glass tabs">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end aria-label={label}>
            <Icon size={22} />
          </NavLink>
        ))}
      </div>
      <button className="glass fab" aria-label="Add" onClick={() => navigate('/add', { state: { bg: location } })}>
        <Plus size={28} strokeWidth={2.4} />
      </button>
    </nav>
  )
}

export function Amount({ tx }: { tx: Pick<Tx, 'type' | 'amount'> }) {
  const [symbol] = useAtom(currencyAtom)
  const sign = tx.type === 'income' ? '+' : '−'
  return <span className={`num ${tx.type === 'income' ? 'inc' : 'exp'}`}>{sign}{money(tx.amount, symbol)}</span>
}

export function TxList({ txs }: { txs: Tx[] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const groups: [string, Tx[]][] = []
  for (const t of txs) {
    const last = groups[groups.length - 1]
    if (last && last[0] === t.date) last[1].push(t)
    else groups.push([t.date, [t]])
  }
  return (
    <div className="card list">
      {groups.map(([date, items]) => (
        <section key={date}>
          <div className="day">{dayLabel(date)}</div>
          {items.map((t) => (
            <button key={t.id} className="row tx" onClick={() => navigate(`/tx/${t.id}`, { state: { bg: location } })}>
              <CatIcon id={t.category} />
              <div className="grow">
                <div>{t.merchant || category(t.category).label}</div>
                {t.note && <div className="sub">{t.note}</div>}
              </div>
              <Amount tx={t} />
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

export function TypeToggle({ value, onChange }: { value: TxType; onChange: (t: TxType) => void }) {
  return (
    <div className="seg" role="group">
      <button className="e" aria-label="Expense" aria-pressed={value === 'expense'} onClick={() => onChange('expense')}>
        <MinusIcon />
      </button>
      <button className="i" aria-label="Income" aria-pressed={value === 'income'} onClick={() => onChange('income')}>
        <Plus size={18} strokeWidth={2.6} />
      </button>
    </div>
  )
}

function MinusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  )
}
