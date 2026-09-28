import { Camera, ChartPie, ChevronLeft, ChevronRight, House, Mic, Paperclip, PenLine, Plus, Settings, Shield, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { setCapture } from '../lib/capture'
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

export function Dock({ admin = false }: { admin?: boolean }) {
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
    { to: '/stats', icon: ChartPie, label: 'Stats' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    ...(admin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
  ]
  return (
    <nav className="dock">
      <div className="glass tabs">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end aria-label={label} onClick={() => setMenu(false)}>
            <Icon size={22} />
          </NavLink>
        ))}
      </div>
      <button className={`glass fab ${menu ? 'open' : ''}`} aria-label={menu ? 'Close add menu' : 'Add'} aria-expanded={menu} onClick={() => setMenu(!menu)}>
        <Plus size={28} strokeWidth={2.4} />
      </button>
      {menu && (
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

const REVEAL = 86

export function TxList({ txs, onDelete }: { txs: Tx[]; onDelete: (tx: Tx) => void }) {
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
  return (
    <div className={`swipe ${open || (dx ?? 0) < 0 ? 'revealed' : ''}`}>
      <button className="swipe-delete" aria-label={`Delete ${label}`} tabIndex={open ? 0 : -1} onClick={onDelete}>
        <Trash2 size={20} />Delete
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
