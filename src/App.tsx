import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { isAdmin } from './lib/access'
import { Usage } from './screens/Usage'
import { Dock } from './components/ui'
import { PasskeyPrompt } from './components/PasskeyPrompt'
import { authClient } from './lib/auth'
import { repo } from './lib/store'
import { AddSheet } from './screens/AddSheet'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'

function Shell() {
  const location = useLocation()
  const { data } = authClient.useSession()
  const admin = isAdmin(data?.user)
  // sheet routes render over the page they were opened from
  const bg = (location.state as { bg?: Location } | null)?.bg
  return (
    <>
      <Routes location={bg ?? location}>
        <Route path="/" element={<Home />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/admin" element={admin ? <main className="screen"><h1>Admin</h1><Usage admin /></main> : <Navigate to="/" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/add" element={<><Home /><AddSheet /></>} />
        <Route path="/tx/:id" element={<><Home /><AddSheet /></>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {bg && (
        <Routes>
          <Route path="/add" element={<AddSheet />} />
          <Route path="/tx/:id" element={<AddSheet />} />
        </Routes>
      )}
      <Dock admin={admin} />
      {data?.user && <PasskeyPrompt key={data.user.id} userId={data.user.id} />}
    </>
  )
}

const IDLE_MS = 15 * 60_000
const ACTIVE_KEY = 'memoney.active'

/** Signs out after 15 minutes without a tap or keypress, counting time the app was closed or in the background. */
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
      void authClient.signOut().then(() => window.location.reload())
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
  const { data, isPending } = authClient.useSession()
  const userId = data?.user.id
  useIdleLogout(data?.session.id)
  useEffect(() => {
    if (userId) repo.load().catch((e) => console.error('[repo]', e))
  }, [userId])
  if (isPending) return null
  return <HashRouter>{userId ? <Shell /> : <Login />}</HashRouter>
}
