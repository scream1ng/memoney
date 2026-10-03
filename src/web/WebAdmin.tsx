import { ChevronLeft, ChevronRight, RefreshCw, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadUsage, type Report } from '../lib/usage'

const dollars = (value: number) => value > 0 && value < 0.0001 ? '<$0.0001' : `$${value.toFixed(4)}`
const day = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** API usage across all accounts, from /api/usage/admin. Admins only. */
export function WebAdmin() {
  const [period, setPeriod] = useState('month')
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [query, setQuery] = useState('')
  const requestKey = `${period}/${offset}/${refresh}`
  const [result, setResult] = useState<{ key: string; report?: Report; error?: string }>()
  const loading = result?.key !== requestKey
  const report = loading ? undefined : result?.report
  const error = loading ? undefined : result?.error
  useEffect(() => {
    const controller = new AbortController()
    loadUsage(true, period, offset, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ key: requestKey, report: data }) })
      .catch((e) => { if (!controller.signal.aborted) setResult({ key: requestKey, error: e.message }) })
    return () => controller.abort()
  }, [period, offset, requestKey])
  const accounts = report?.accounts ?? []
  const total = accounts.reduce((sum, a) => ({ usd: sum.usd + a.usd, calls: sum.calls + a.calls, unknown: sum.unknown + a.unknown, camera: sum.camera + a.camera, voice: sum.voice + a.voice }), { usd: 0, calls: 0, unknown: 0, camera: 0, voice: 0 })
  const active = accounts.filter((a) => a.calls > 0).length
  const lastDay = report ? new Date(`${report.end}T00:00:00Z`) : undefined
  lastDay?.setUTCDate(lastDay.getUTCDate() - 1)
  const q = query.trim().toLowerCase()
  const rows = accounts.filter((a) => !q || [a.name, a.email].some((s) => s?.toLowerCase().includes(q)))

  return (
    <div className="wd-page">
      <header className="wd-top">
        <h1>Admin</h1>
        <div className="wd-period">
          <div className="seg period-toggle" role="group" aria-label="Usage period">
            {['week', 'month'].map((p) => <button key={p} aria-pressed={period === p} onClick={() => { setPeriod(p); setOffset(0) }}>{p === 'week' ? 'Weekly' : 'Monthly'}</button>)}
          </div>
          <button className="icon-btn" aria-label="Previous period" disabled={offset <= -120} onClick={() => setOffset((n) => n - 1)}><ChevronLeft size={20} /></button>
          <span className="wd-period-label wd-range" aria-live="polite">{report && lastDay ? `${day(report.start)} – ${day(lastDay.toISOString().slice(0, 10))}` : offset === 0 ? `This ${period}` : 'Earlier period'}</span>
          <button className="icon-btn" aria-label="Next period" disabled={offset === 0} onClick={() => setOffset((n) => n + 1)}><ChevronRight size={20} /></button>
        </div>
        <button className="icon-btn" aria-label="Refresh usage" disabled={loading} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button>
      </header>
      <div className="wd-body" aria-busy={loading}>
        {loading && <p className="muted" role="status">Loading usage…</p>}
        {error && <div className="warn" role="alert"><TriangleAlert size={18} />{error}<button className="wd-link" onClick={() => setRefresh((n) => n + 1)}>Retry</button></div>}
        {report && <>
          <div className="wd-kpis wd-kpis4">
            <div className="card wd-kpi"><small>Estimated cost</small><div className="num">{dollars(total.usd)}</div><div className="sub">USD{total.unknown > 0 ? ' · partial total' : ''}</div></div>
            <div className="card wd-kpi"><small>Camera calls</small><div className="num">{total.camera}</div><div className="sub">Receipt photos read</div></div>
            <div className="card wd-kpi"><small>Voice calls</small><div className="num">{total.voice}</div><div className="sub">Voice may use two calls</div></div>
            <div className="card wd-kpi"><small>Active accounts</small><div className="num">{active}</div><div className="sub">of {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</div></div>
          </div>
          {total.unknown > 0 && <div className="warn"><TriangleAlert size={18} />
            {total.unknown === 1 ? '1 call has an unavailable cost and is left out of the total.' : `${total.unknown} calls have an unavailable cost and are left out of the total.`}</div>}
          <section className="card wd-table wd-usage">
            <div className="wd-table-head">
              <label className="wd-search"><Search size={18} /><input type="search" placeholder="Search name or email" aria-label="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            </div>
            {total.calls === 0 && <div className="wd-empty">No API activity recorded for this period.</div>}
            {rows.length ? (
              <table>
                <thead><tr><th>Account</th><th className="n">Camera</th><th className="n">Voice</th><th className="n">Est. cost</th><th className="n">Share of cost</th></tr></thead>
                <tbody>
                  {rows.map((a) => {
                    const share = total.usd > 0 ? a.usd / total.usd : 0
                    return (
                      <tr key={a.id} className={a.calls ? undefined : 'idle'}>
                        <td><div className="wd-who"><span className="wd-avatar" aria-hidden>{(a.name || a.email).slice(0, 1).toUpperCase()}</span>
                          <span>{a.name || a.email}{a.name && <small>{a.email}</small>}</span></div></td>
                        <td className="n num">{a.camera}</td>
                        <td className="n num">{a.voice}</td>
                        <td className="n num">{a.calls ? `${dollars(a.usd)}${a.unknown > 0 ? '*' : ''}` : '—'}</td>
                        <td className="n">{a.calls ? <div className="wd-share"><div className="bar"><i style={{ width: `${share * 100}%` }} /></div><small>{Math.round(share * 100)}%</small></div>
                          : <span className="muted">No activity</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : accounts.length ? <div className="wd-empty">No accounts match.<button onClick={() => setQuery('')}>Show all</button></div> : null}
            <div className="wd-tip">* includes unpriced calls. New activity only; costs are estimates.</div>
          </section>
        </>}
      </div>
    </div>
  )
}
