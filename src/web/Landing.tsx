import { Check, FileText, List, Mic } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth'
import { GoogleG } from '../screens/Login'
import { startDemo } from './landingDemo'

const STEPS = [
  [Mic, 'Speak or scan', 'Say “ชานม 26 บาท” or snap a receipt.'],
  [Check, 'Check', 'Amount, category and note are filled in for you.'],
  [List, 'Saved', 'Tap Save and it’s in your list.'],
  [FileText, 'Report', 'Print it, or download a PDF or CSV.'],
] as const

/** Signed-out desktop web. Phones and the installed app keep <Login />. */
export function Landing() {
  const navigate = useNavigate()
  const stage = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(1)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // whatever screen the session ended on, signing in starts at the dashboard
  useEffect(() => {
    navigate('/', { replace: true })
  }, [navigate])
  // the phone scales with the window height, between 0.6 and 1
  useLayoutEffect(() => {
    const fit = () => {
      const s = Math.min(1, Math.max(0.6, (window.innerHeight - 140) / 740), (window.innerWidth - 48) / 375)
      stage.current?.style.setProperty('--s', s.toFixed(3))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  useEffect(() => startDemo(stage.current!, setStep), [])
  const google = async () => {
    if (pending) return
    setPending(true)
    setFailed(false)
    try {
      const r = await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
      if (r?.error) { setFailed(true); setPending(false) }
    } catch {
      setFailed(true)
      setPending(false)
    }
  }
  return (
    <main className="web-landing">
      <header className="wl-top">
        <div className="brand"><img src="/favicon.svg" alt="" />MeMoney</div>
        <div className="signin">
          <button className="primary" disabled={pending} onClick={() => void google()}><GoogleG />{pending ? 'Opening Google…' : 'Sign in with Google'}</button>
          {failed && <p className="warn" role="alert">Couldn’t reach Google. Try again.</p>}
        </div>
      </header>
      <section className="wl-hero">
        <div className="wl-copy">
          <h1 className="wl-tagline">Say it or snap it.<br />MeMoney writes it down.</h1>
          <p className="wl-lede">Log spending with your voice or a receipt photo. You check every entry before it’s saved.</p>
          <ol className="wl-steps" aria-label="How it works">
            {STEPS.map(([Icon, title, text], n) => (
              <li key={title} className={step === n + 1 ? 'on' : undefined}>
                <span className="wl-tile"><Icon size={22} /></span>
                <span><strong>{title}</strong><small>{text}</small></span>
              </li>
            ))}
          </ol>
        </div>
        <div className="wl-stage" ref={stage} aria-hidden="true">
          <div className="wl-phone" />
          <div className="wl-paper" hidden />
        </div>
      </section>
    </main>
  )
}
