import { Camera, Download, House, Mic, Paperclip, PenLine, Plus, Settings, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDeleteTap } from '../hooks/useDeleteTap'
import { setCapture } from '../lib/capture'
import { category, useCustomCategories } from '../lib/categories'
import { dayLabel, money } from '../lib/format'
import { currencyAtom, useAtom, type Period } from '../lib/store'
import type { Tx, TxType } from '../lib/types'

export function CatIcon({ id, size = 22 }: { id: string; size?: number }) {
  useCustomCategories()
  const c = category(id)
  const Icon = c.icon
  return (
    <span className="cat" style={{ background: c.color }} aria-label={c.label} role="img">
      <Icon size={size} strokeWidth={2} />
    </span>
  )
}

function ReportBars({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
}

export function Dock({ onExport, onAddCategory }: { onExport: () => void; onAddCategory: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  // the menu belongs to the page it was opened on, so any navigation closes it
  const [menuAt, setMenuAt] = useState<string>()
  const menu = menuAt === location.key
  const setMenu = (open: boolean) => setMenuAt(open ? location.key : undefined)
  // stays mounted while the menu closes, or the picked photo's change event is lost
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAt(undefined)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])
  const open = (via?: 'camera' | 'voice') => {
    setMenu(false) // or Back to this page would show it again
    navigate(via ? `/add?via=${via}` : '/add', { state: { bg: location } })
  }
  function voice() {
    // ask for the mic inside the tap; the sheet takes the stream
    const stream = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ audio: true })
      : Promise.reject(new Error('Microphone not available'))
    stream.catch(() => {}) // handled by the sheet
    setCapture({ kind: 'audio', stream })
    open('voice')
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCapture({ kind: 'image', file })
    open('camera')
  }
  function camera() {
    setMenu(false)
    fileRef.current?.click()
  }
  const tabs = [
    { to: '/', icon: House, label: 'Home' },
    { to: '/stats', icon: ReportBars, label: 'Stats' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]
  const isHome = location.pathname === '/'
  const isStats = location.pathname === '/stats'
  const isCategories = location.pathname === '/settings/categories'
  return (
    <nav className={`dock${isHome || isStats || isCategories ? '' : ' no-fab'}`}>
      <div className="glass tabs">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to !== '/settings'} aria-label={label} onClick={() => setMenu(false)}>
            <Icon size={22} />
          </NavLink>
        ))}
      </div>
      {isStats ? (
        <button className="glass fab" aria-label="Export report" onClick={onExport}><Download size={26} strokeWidth={2.2} /></button>
      ) : isHome ? (
        <button className={`glass fab ${menu ? 'open' : ''}`} aria-label={menu ? 'Close add menu' : 'Add'} aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <Plus size={28} strokeWidth={2.4} />
        </button>
      ) : isCategories ? (
        <button className="glass fab" aria-label="Add category" onClick={onAddCategory}><Plus size={28} strokeWidth={2.4} /></button>
      ) : null}
      {isHome && menu && (
        <>
          <div className="menu-shade" onClick={() => setMenu(false)} />
          <div className="quick-actions" role="menu">
            <MenuAction label="Manual" icon={PenLine} onClick={() => open()} />
            <MenuAction label="Camera" icon={Camera} onClick={camera} />
            <MenuAction label="Voice" icon={Mic} onClick={voice} />
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </nav>
  )
}

function MenuAction({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button role="menuitem" className="action" onClick={onClick}>
      <span className="action-label">{label}</span>
      <span className="round"><Icon size={24} /></span>
    </button>
  )
}

export function Amount({ tx }: { tx: Pick<Tx, 'type' | 'amount'> }) {
  const [symbol] = useAtom(currencyAtom)
  const sign = tx.type === 'income' ? '+' : '−'
  return <span className={`num ${tx.type === 'income' ? 'inc' : 'exp'}`}>{sign}{money(tx.amount, symbol)}</span>
}

const REVEAL = 96

export function TxList({ txs, onDelete }: { txs: Tx[]; onDelete: (tx: Tx) => void }) {
  useCustomCategories()
  const navigate = useNavigate()
  const location = useLocation()
  // only one row stays open; deleting needs a tap on Delete, never just a long swipe
  const [openId, setOpenId] = useState<string>()
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
            <SwipeRow key={t.id} open={openId === t.id} onOpen={(o) => setOpenId(o ? t.id : undefined)}
              onDelete={() => { setOpenId(undefined); onDelete(t) }}
              onTap={() => (openId ? setOpenId(undefined) : navigate(`/tx/${t.id}`, { state: { bg: location } }))}
              label={t.merchant || category(t.category).label}>
              <CatIcon id={t.category} />
              <div className="grow">
                <div>{t.merchant || category(t.category).label}</div>
                {t.note && <div className="sub">{t.note}</div>}
              </div>
              {t.photoAt && <Paperclip size={14} className="clip-mark" aria-label="Has receipt" />}
              <Amount tx={t} />
            </SwipeRow>
          ))}
        </section>
      ))}
    </div>
  )
}

function SwipeRow({ open, onOpen, onDelete, onTap, label, children }: {
  open: boolean; onOpen: (open: boolean) => void; onDelete: () => void; onTap: () => void; label: string; children: React.ReactNode
}) {
  const [dx, setDx] = useState<number>()
  const drag = useRef<{ x: number; y: number; id: number; swiping: boolean; moved: boolean; dx: number }>(null)
  const base = open ? -REVEAL : 0
  const x = dx ?? base
  const canDelete = open && dx === undefined
  const deleteTap = useDeleteTap(onDelete, canDelete)
  return (
    <div className={`swipe ${open || (dx ?? 0) < 0 ? 'revealed' : ''}`}>
      <button className="swipe-delete" aria-label={`Delete ${label}`} tabIndex={canDelete ? 0 : -1} disabled={!canDelete} {...deleteTap}>
        Delete
      </button>
      <button
        className="row tx"
        style={{ transform: x ? `translateX(${x}px)` : undefined, transition: dx === undefined ? undefined : 'none' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false, moved: false, dx: base }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const mx = e.clientX - d.x
          const my = e.clientY - d.y
          if (!d.swiping) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { drag.current = null; return } // a scroll
            if (Math.abs(mx) < 10) return
            d.swiping = true
            d.moved = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          d.dx = Math.max(-REVEAL * 1.5, Math.min(0, base + mx))
          setDx(d.dx)
        }}
        onPointerUp={() => {
          const d = drag.current
          if (!d?.swiping) return
          onOpen(d.dx < -REVEAL / 2)
          setDx(undefined)
        }}
        onPointerCancel={() => { drag.current = null; setDx(undefined) }}
        onClick={() => {
          // a swipe ends with a click; swallow it
          if (drag.current?.moved) { drag.current = null; return }
          drag.current = null
          onTap()
        }}
      >
        {children}
      </button>
    </div>
  )
}

const PERIODS: [Period, string][] = [['day', 'Day'], ['week', 'Week'], ['month', 'Month']]

export function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="seg period-toggle" role="group" aria-label="Time period">
      {PERIODS.map(([p, label]) => <button key={p} aria-pressed={value === p} onClick={() => onChange(p)}>{label}</button>)}
    </div>
  )
}

export function TypeToggle({ value, onChange, disabled = false }: { value: TxType; onChange: (t: TxType) => void; disabled?: boolean }) {
  return (
    <div className="seg" role="group">
      <button className="e" disabled={disabled} aria-label="Expense" aria-pressed={value === 'expense'} onClick={() => onChange('expense')}>
        <MinusIcon />
      </button>
      <button className="i" disabled={disabled} aria-label="Income" aria-pressed={value === 'income'} onClick={() => onChange('income')}>
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
