import { useSyncExternalStore } from 'react'
import { cached, writeCache } from './cache'
import { currencyAtom } from './store'

const chosenOnThisDevice = () => {
  try { return localStorage.getItem('pocket.currency') !== null } catch { return false }
}

/** Account preferences kept on the server: the currency symbol and monthly limits per expense category. */
function apiSettings() {
  const listeners = new Set<() => void>()
  let budgets: Record<string, number> = cached?.budgets ?? {}
  const setBudgets = (next: Record<string, number>) => {
    budgets = next
    writeCache('budgets', next)
    listeners.forEach((l) => l())
  }
  const call = (path: string, init?: RequestInit) =>
    fetch(`/api/settings${path}`, { credentials: 'include', ...init }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} settings${path}`)
      return r
    })
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  return {
    budgets: () => budgets,
    async load() {
      const s = (await (await call('')).json()) as { currency: string | null; budgets: Record<string, number> }
      // first load after this update: the account takes the currency this device's user picked,
      // never the built-in default, which would overwrite a choice made on another device
      if (s.currency !== null) currencyAtom.set(s.currency)
      else if (chosenOnThisDevice()) await call('/currency', json('PUT', { currency: currencyAtom.get() }))
      setBudgets(s.budgets)
    },
    /** Shows the new symbol at once; puts the old one back if the server refuses. */
    async setCurrency(currency: string) {
      const before = currencyAtom.get()
      currencyAtom.set(currency)
      try { await call('/currency', json('PUT', { currency })) }
      catch (e) { currencyAtom.set(before); throw e }
    },
    /** amount in minor units; null removes the limit */
    async setBudget(category: string, amount: number | null) {
      if (amount === null) await call(`/budgets/${encodeURIComponent(category)}`, { method: 'DELETE' })
      else await call(`/budgets/${encodeURIComponent(category)}`, json('PUT', { amount }))
      const next = { ...budgets }
      if (amount === null) delete next[category]
      else next[category] = amount
      setBudgets(next)
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}

export const settingsRepo = apiSettings()

export function useBudgets(): Record<string, number> {
  return useSyncExternalStore(settingsRepo.subscribe, settingsRepo.budgets)
}
