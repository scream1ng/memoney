import { ChevronDown, LogOut } from 'lucide-react'
import { authClient } from '../lib/auth'
import { CURRENCIES, CURRENCY_NAMES } from '../lib/currencies'
import { currencyAtom, useAtom } from '../lib/store'

/** Account, currency and sign-out. Passkeys belong to the phone app; API usage is on the Admin page. */
export function WebSettings() {
  const { data } = authClient.useSession()
  const [cur, setCur] = useAtom(currencyAtom)
  const name = data?.user.name || data?.user.email || ''
  // reload drops the signed-out user's transactions from memory
  const signOut = () => authClient.signOut().then(() => window.location.reload())
  return (
    <div className="wd-page">
      <header className="wd-top"><h1>Settings</h1></header>
      <div className="wd-body wd-set">
        <section className="card wd-sec"><h2>Account</h2>
          <div className="wd-srow">
            <span className="wd-avatar lg" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
            <span className="grow">{name}<small>{data?.user.email && data.user.name ? `${data.user.email} · ` : ''}Signed in with Google</small></span>
            <button className="wd-btn" onClick={signOut}><LogOut size={18} />Sign out</button>
          </div>
        </section>
        <section className="card wd-sec"><h2>Preferences</h2>
          <label className="wd-srow">
            <span className="grow">Currency<small>Shown on amounts and reports</small></span>
            <span className="wd-select">
              <select value={cur} onChange={(e) => setCur(e.target.value)}>
                {CURRENCIES.map((c, i) => <option key={c} value={c}>{c ? `${c}  ${CURRENCY_NAMES[i]}` : CURRENCY_NAMES[i]}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden />
            </span>
          </label>
        </section>
      </div>
    </div>
  )
}
