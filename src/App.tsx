import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { Dock } from './components/ui'
import { authClient } from './lib/auth'
import { repo } from './lib/store'
import { AddSheet } from './screens/AddSheet'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Settings } from './screens/Settings'
import { Stats } from './screens/Stats'

function Shell() {
  const location = useLocation()
  // sheet routes render over the page they were opened from
  const bg = (location.state as { bg?: Location } | null)?.bg
  return (
    <>
      <Routes location={bg ?? location}>
        <Route path="/" element={<Home />} />
        <Route path="/stats" element={<Stats />} />
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
      <Dock />
    </>
  )
}

export default function App() {
  const { data, isPending } = authClient.useSession()
  const userId = data?.user.id
  useEffect(() => {
    if (userId) repo.load().catch((e) => console.error('[repo]', e))
  }, [userId])
  if (isPending) return null
  return <HashRouter>{userId ? <Shell /> : <Login />}</HashRouter>
}
