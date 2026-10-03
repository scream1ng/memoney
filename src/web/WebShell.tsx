import { ChevronLeft, ChevronRight, FileText, Grid2X2, House, LogOut, Settings as SettingsIcon, ShieldCheck, TriangleAlert, Upload as UploadIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { matchPath, Navigate, NavLink, Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom'
import { isAdmin } from '../lib/access'
import { authClient } from '../lib/auth'
import { monthLabel, shiftMonth, shiftWeek, weekLabel } from '../lib/format'
import { monthAtom, periodAtom, useAtom, weekAtom } from '../lib/store'
import { EntryPanel } from './EntryPanel'
import { Overview } from './Overview'
import { Reports } from './Reports'
import { Review } from './Review'
import { acceptsDrop } from './drop'
import { addFiles, dismissSkipped, pending, useReviewShown, useSkipped, useUploads } from './uploads'
import { WebAdmin } from './WebAdmin'
import { WebCategories } from './WebCategories'
import { WebSettings } from './WebSettings'

const NAV = [
  ['/', House, 'Overview'],
  ['/reports', FileText, 'Reports'],
  ['/settings/categories', Grid2X2, 'Categories'],
  ['/settings', SettingsIcon, 'Settings'],
] as const

/** Signed-in desktop web: sidebar + pages. Shares routes and data with the phone UI. */
export function WebShell() {
  const location = useLocation()
  const reviewing = useReviewShown()
  const skipped = useSkipped()
  const [dragging, setDragging] = useState(false)
  const { data } = authClient.useSession()
  const admin = isAdmin(data?.user)
  // the entry panel renders over the page it was opened from, like the phone's sheet routes
  const bg = (location.state as { bg?: Location } | null)?.bg
  const page = bg ?? location
  const selected = bg && matchPath('/tx/:id', location.pathname)?.params.id
  const name = data?.user.name || data?.user.email || ''
  // receipts dropped anywhere in the window are added; without this the browser would open the image instead
  useEffect(() => {
    let depth = 0 // dragenter/leave fire for every child crossed
    const enter = (e: DragEvent) => { if (acceptsDrop(e)) { depth++; setDragging(true) } }
    const leave = (e: DragEvent) => { if (acceptsDrop(e) && --depth <= 0) { depth = 0; setDragging(false) } }
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const files = [...(e.dataTransfer?.files ?? [])]
      if (files.length && acceptsDrop(e)) addFiles(files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [])
  // all the dropped files weren't images, so Review didn't open: say so here
  useEffect(() => {
    if (!skipped || reviewing) return
    const t = setTimeout(dismissSkipped, 6000)
    return () => clearTimeout(t)
  }, [skipped, reviewing])
  // receipts live only in this tab until each one is saved
  const unsaved = useUploads().some(pending)
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])
  return (
    <div className="web">
      <aside className="wd-side" inert={reviewing}>
        <div className="brand"><img src="/favicon.svg" alt="" />MeMoney</div>
        <nav aria-label="Main">
          {[...NAV, ...(admin ? [['/admin', ShieldCheck, 'Admin'] as const] : [])].map(([to, Icon, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `wd-nav${isActive ? ' on' : ''}`}><Icon size={20} />{label}</NavLink>
          ))}
        </nav>
        <AccountMenu name={name} />
      </aside>
      <div className="wd-main" key={page.pathname} inert={reviewing}>
        <Routes location={page}>
          <Route path="/" element={<Overview selected={selected} />} />
          <Route path="/upload" element={<Navigate to="/" replace />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/stats" element={<Navigate to="/reports" replace />} />
          <Route path="/admin" element={admin ? <WebAdmin /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={<WebSettings />} />
          <Route path="/settings/admin" element={<Navigate to="/admin" replace />} />
          <Route path="/settings/categories" element={<WebCategories />} />
          <Route path="/add" element={<><Overview /><EntryPanel /></>} />
          <Route path="/tx/:id" element={<><Overview /><EntryPanel /></>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {reviewing && <Review />}
      {bg && (
        <Routes>
          <Route path="/add" element={<EntryPanel />} />
          <Route path="/tx/:id" element={<EntryPanel />} />
        </Routes>
      )}
      {!!skipped && !reviewing && <div className="warn wd-toast" role="alert"><TriangleAlert size={18} />
        {skipped === 1 ? 'That file wasn’t an image, so it wasn’t added.' : `Those ${skipped} files weren’t images, so they weren’t added.`}</div>}
      {dragging && <div className="wd-dropover" aria-hidden><div><UploadIcon size={40} /><strong>Drop to add receipts</strong>
        <small>JPG or PNG · as many as you like · you’ll check each one before it’s saved</small></div></div>}
    </div>
  )
}

/** The name at the foot of the sidebar opens a small menu: Settings and Sign out. */
function AccountMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    box.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector<HTMLElement>('.wd-me')?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="wd-acct" ref={box}>
      {open && <div className="card wd-menu" role="menu" aria-label="Account">
        <button role="menuitem" onClick={() => { setOpen(false); navigate('/settings') }}><SettingsIcon size={18} />Settings</button>
        {/* reload drops the signed-out user's transactions from memory */}
        <button role="menuitem" onClick={() => authClient.signOut().then(() => window.location.reload())}><LogOut size={18} />Sign out</button>
      </div>}
      <button className="wd-me" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="wd-avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
        <span><span className="wd-name">{name}</span><small className="muted">Signed in with Google</small></span>
      </button>
    </div>
  )
}

/** Week/Month and the period arrows, shared with the phone screens' selection. */
export function PeriodControl() {
  const [period, setPeriod] = useAtom(periodAtom)
  const [month, setMonth] = useAtom(monthAtom)
  const [week, setWeek] = useAtom(weekAtom)
  const shift = (d: number) => (period === 'week' ? setWeek(shiftWeek(week, d)) : setMonth(shiftMonth(month, d)))
  return (
    <div className="wd-period">
      <div className="seg period-toggle" role="group" aria-label="Time period">
        <button aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Week</button>
        <button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>Month</button>
      </div>
      <button className="icon-btn" aria-label={period === 'week' ? 'Previous week' : 'Previous month'} onClick={() => shift(-1)}><ChevronLeft size={20} /></button>
      <span className="wd-period-label" aria-live="polite">{period === 'week' ? weekLabel(week) : monthLabel(month)}</span>
      <button className="icon-btn" aria-label={period === 'week' ? 'Next week' : 'Next month'} onClick={() => shift(1)}><ChevronRight size={20} /></button>
    </div>
  )
}
