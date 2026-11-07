import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { isAdmin } from './lib/access'
import { Usage } from './screens/Usage'
import { Dock } from './components/ui'
import { PasskeyPrompt } from './components/PasskeyPrompt'
import { authClient, signOut } from './lib/auth'
import { ACTIVE_KEY, cached, clearCache, IDLE_MS, setCacheUser } from './lib/cache'
import { deleteFailureAtom, repo, useAtom } from './lib/store'
import { AddSheet } from './screens/AddSheet'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Settings } from './screens/Settings'
import { Categories } from './screens/Categories'
import { Stats } from './screens/Stats'
import { NoteSheet, Notes } from './screens/Notes'
import { loadAll, refreshAll } from './lib/sync'
import { useDesktop } from './lib/useDesktop'

// phones never load the desktop dashboard or landing page code
const Landing = lazy(() => import('./web/Landing').then((m) => ({ default: m.Landing })))
const WebShell = lazy(() => import('./web/WebShell').then((m) => ({ default: m.WebShell })))

function Shell() {
  const location = useLocation()
  const [exportAt, setExportAt] = useState<string>()
  const [addCategoryRequest, setAddCategoryRequest] = useState(0)
  const { data } = authClient.useSession()
  const admin = isAdmin(data?.user)
  // sheet routes render over the page they were opened from
  const bg = (location.state as { bg?: Location } | null)?.bg
  const page = bg ?? location
  const scrollPositions = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const positions = scrollPositions.current
    window.scrollTo({ top: positions.get(page.key) ?? 0, behavior: 'instant' })
    return () => { positions.set(page.key, window.scrollY) }
  }, [page.key])
  return (
    <>
      <Routes location={page}>
        <Route path="/" element={<Home />} />
        <Route path="/stats" element={<Stats exportOpen={exportAt === location.key} onCloseExport={() => setExportAt(undefined)} />} />
        <Route path="/admin" element={<Navigate to={admin ? '/settings/admin' : '/settings'} replace />} />
        <Route path="/settings" element={<Settings admin={admin} />} />
        <Route path="/settings/admin" element={admin ? <main className="screen"><h1>Admin Panel</h1><Usage admin /></main> : <Navigate to="/settings" replace />} />
        <Route path="/settings/categories" element={<Categories addRequest={addCategoryRequest} />} />
        <Route path="/add" element={<><Home /><AddSheet /></>} />
        <Route path="/tx/:id" element={<><Home /><AddSheet /></>} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/new" element={<><Notes /><NoteSheet /></>} />
        <Route path="/notes/:id" element={<><Notes /><NoteSheet /></>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {bg && (
        <Routes>
          <Route path="/add" element={<AddSheet />} />
          <Route path="/tx/:id" element={<AddSheet />} />
          <Route path="/notes/new" element={<NoteSheet />} />
          <Route path="/notes/:id" element={<NoteSheet />} />
        </Routes>
      )}
      <DeleteFailureNotice />
      <Dock onExport={() => setExportAt(location.key)} onAddCategory={() => setAddCategoryRequest((n) => n + 1)} />
      {data?.user && <PasskeyPrompt key={data.user.id} userId={data.user.id} />}
    </>
  )
}

function DeleteFailureNotice() {
  const [failed, setFailed] = useAtom(deleteFailureAtom)
  const [pending, setPending] = useState(false)
  if (!failed) return null
  const retry = async () => {
    if (pending) return
    setPending(true)
    try { await repo.remove(failed.id); setFailed(undefined) }
    catch { /* retain the visible error and retry action */ }
    finally { setPending(false) }
  }
  return <div className="glass write-notice" role="alert">
    <p>Could not confirm deletion. Your entry is still shown.</p>
    <div className="row"><button disabled={pending} onClick={() => void retry()}>{pending ? 'Deleting…' : 'Retry delete'}</button>
      <button disabled={pending} onClick={() => setFailed(undefined)}>Dismiss</button></div>
  </div>
}


/** Signs out after 7 days without a tap or keypress, counting time the app was closed or in the background. */
function useIdleLogout(sessionId: string | undefined) {
  useEffect(() => {
    if (!sessionId) return
    let last = Date.now()
    try {
      // "<session id> <ms>": a timestamp left by an older session doesn't count
      const [id, ms] = (localStorage.getItem(ACTIVE_KEY) ?? '').split(' ')
      if (id === sessionId && Number(ms)) last = Number(ms)
    } catch { /* ignore */ }
    const save = () => {
      try { localStorage.setItem(ACTIVE_KEY, `${sessionId} ${last}`) } catch { /* ignore */ }
    }
    let out = false
    const check = () => {
      if (out || Date.now() - last <= IDLE_MS) return
      out = true
      void signOut()
    }
    const touch = () => {
      check()
      last = Date.now()
      save()
    }
    check()
    save()
    const timer = setInterval(check, 30_000)
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      document.removeEventListener('visibilitychange', check)
    }
  }, [sessionId])
}

export default function App() {
  const { data, isPending, error } = authClient.useSession()
  const confirmed = data?.user.id
  // only the server saying "not signed in" counts; offline or a server error is not an answer
  const answered = !isPending && (!error || error.status === 401)
  // until then, open straight to the last account's saved data (also how the app opens offline)
  const userId = confirmed ?? (answered ? undefined : cached?.user)
  const desktop = useDesktop()
  useIdleLogout(data?.session.id)
  useEffect(() => {
    if (!answered) return
    if (cached && cached.user !== confirmed) {
      // signed out, expired, or another account: drop the saved data and anything already shown from it
      clearCache()
      window.location.reload()
      return
    }
    if (!confirmed) return
    setCacheUser(confirmed)
    void loadAll(confirmed)
    const onShow = () => { if (document.visibilityState === 'visible') void refreshAll() }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [confirmed, answered])
  if (isPending && !userId) return null
  // desktop browsers get the landing page and web dashboard; phones and the installed app keep the mobile UI
  return <HashRouter><Suspense fallback={null}>{userId ? desktop ? <WebShell /> : <Shell /> : desktop ? <Landing /> : <Login />}</Suspense></HashRouter>
}
