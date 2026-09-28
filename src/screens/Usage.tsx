import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadUsage, type Report } from '../lib/usage'

const dollars = (value: number) => value > 0 && value < 0.0001 ? '<$0.0001' : `$${value.toFixed(4)}`
const label = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function Usage({ admin = false }: { admin?: boolean }) {
  const [period, setPeriod] = useState('month')
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const requestKey = `${admin}/${period}/${offset}/${refresh}`
  const [result, setResult] = useState<{ key: string; report?: Report; error?: string }>()
  const loading = result?.key !== requestKey
  const report = loading ? undefined : result?.report
  const error = loading ? undefined : result?.error
  useEffect(() => {
    const controller = new AbortController()
    loadUsage(admin, period, offset, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ key: requestKey, report: data }) })
      .catch((e) => { if (!controller.signal.aborted) setResult({ key: requestKey, error: e.message }) })
    return () => controller.abort()
  }, [admin, period, offset, requestKey])
  const total = report?.accounts.reduce((sum, a) => ({ usd: sum.usd + a.usd, calls: sum.calls + a.calls, unknown: sum.unknown + a.unknown, camera: sum.camera + a.camera, voice: sum.voice + a.voice }), { usd: 0, calls: 0, unknown: 0, camera: 0, voice: 0 })
  const lastDay = report ? new Date(`${report.end}T00:00:00Z`) : undefined
  lastDay?.setUTCDate(lastDay.getUTCDate() - 1)
  return (
    <section className="card usage" aria-label={admin ? 'All accounts API usage' : 'Your API usage'}>
      <div className="row between"><h2>{admin ? 'All accounts' : 'API usage'}</h2><button className="icon-btn" aria-label="Refresh usage" disabled={loading} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button></div>
      <div className="seg usage-period" role="group" aria-label="Usage period">
        {['week', 'month'].map((p) => <button key={p} aria-pressed={period === p} onClick={() => { setPeriod(p); setOffset(0) }}>{p === 'week' ? 'Weekly' : 'Monthly'}</button>)}
      </div>
      <div className="row between usage-range">
        <button className="icon-btn" aria-label="Previous period" disabled={offset <= -120} onClick={() => setOffset((n) => n - 1)}><ChevronLeft size={18} /></button>
        <span>{report && lastDay ? `${label(report.start)} – ${label(lastDay.toISOString().slice(0, 10))}` : offset === 0 ? `This ${period}` : 'Earlier period'}</span>
        <button className="icon-btn" aria-label="Next period" disabled={offset === 0} onClick={() => setOffset((n) => n + 1)}><ChevronRight size={18} /></button>
      </div>
      <div className="usage-result" aria-live="polite" aria-busy={loading}>
        {loading && <p className="sub">Loading usage…</p>}
        {error && <p className="warn" role="alert">{error} <button className="chip" onClick={() => setRefresh((n) => n + 1)}>Retry</button></p>}
        {total && <>
          <div className="usage-amount num">{dollars(total.usd)}</div>
          <p className="sub">Estimated USD{total.unknown > 0 ? ' · partial total' : ''}</p>
          <div className="usage-counts"><span><strong>{total.camera}</strong> Camera calls</span><span><strong>{total.voice}</strong> Voice calls</span></div>
          {total.unknown > 0 && <p className="warn">{total.unknown} {total.unknown === 1 ? 'call has an unavailable cost' : 'calls have unavailable costs'} and {total.unknown === 1 ? 'is' : 'are'} excluded from this total.</p>}
          {total.calls === 0 && <p className="sub">No API activity recorded for this period.</p>}
          {admin && <div className="usage-accounts">
            <h3>Accounts <span className="sub">({report?.accounts.length})</span></h3>
            {report?.accounts.map((a) => <details key={a.id}>
              <summary><span className="usage-person"><strong>{a.name || a.email}</strong><span className="sub">{a.email}</span></span><span className="num">{dollars(a.usd)}{a.unknown > 0 ? '*' : ''}</span><ChevronRight className="usage-chevron" size={16} /></summary>
              <p className="sub">{a.camera} camera calls · {a.voice} voice calls{a.unknown > 0 ? ` · ${a.unknown} unpriced` : ''}</p>
            </details>)}
          </div>}
        </>}
      </div>
      <p className="sub usage-note">New activity only. Voice uses Luna; costs are estimates.</p>
    </section>
  )
}
