export type AccountUsage = { id: string; name: string; email: string; calls: number; camera: number; voice: number; unknown: number; usd: number }
export type Report = { start: string; end: string; accounts: AccountUsage[] }

export async function loadUsage(admin: boolean, period: string, offset: number, signal: AbortSignal): Promise<Report> {
  const timeout = AbortSignal.timeout(15_000)
  try {
    const response = await fetch(`/api/usage/${admin ? 'admin' : 'me'}?period=${period}&offset=${offset}`, {
      signal: AbortSignal.any([signal, timeout]), cache: 'no-store',
    })
    if (!response.ok) throw new Error(response.status === 403 ? 'Admin access required.' : 'Couldn’t load usage. Try again.')
    return await response.json() as Report
  } catch (error) {
    if (timeout.aborted && !signal.aborted) throw new Error('Usage took too long to load. Try again.')
    throw error
  }
}
