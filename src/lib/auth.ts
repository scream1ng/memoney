import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/react'
import { clearCache } from './cache'

export const authClient = createAuthClient({ plugins: [passkeyClient()] })

/** Drops this device's saved data before the reload, so the next screen can never show the old account. */
export const signOut = () => {
  clearCache()
  return authClient.signOut().then(() => window.location.reload())
}
