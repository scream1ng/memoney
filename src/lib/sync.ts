import { categoryRepo } from './categories'
import { notesRepo } from './notes'
import { settingsRepo } from './settings'
import { repo } from './store'

/** Fetch everything the signed-in account owns. Each part fails on its own, so one bad request doesn't block the rest. */
export function loadAll(userId?: string, refresh = false) {
  return Promise.all([
    repo.load().catch((e) => console.error('[repo]', e)),
    (refresh ? categoryRepo.refresh(userId) : categoryRepo.load(userId)).catch((e) => console.error('[categories]', e)),
    notesRepo.load().catch((e) => console.error('[notes]', e)),
    settingsRepo.load().catch((e) => console.error('[settings]', e)),
  ])
}

let last = 0
let running: Promise<unknown> | undefined

/** Pull-to-refresh and returning to the app; `force` skips the 30-second minimum gap. */
export function refreshAll(force = false): Promise<unknown> {
  if (running) return running
  if (!force && Date.now() - last < 30_000) return Promise.resolve()
  last = Date.now()
  running = loadAll(undefined, true).finally(() => { running = undefined })
  return running
}
