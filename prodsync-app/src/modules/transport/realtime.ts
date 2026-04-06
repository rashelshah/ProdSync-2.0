import { io, type Socket } from 'socket.io-client'
import { apiOrigin } from '@/lib/api'
import { supabase } from '@/lib/supabase'

let transportSocket: Socket | null = null
let pendingSocketPromise: Promise<Socket | null> | null = null

export async function getTransportSocket() {
  if (transportSocket) {
    return transportSocket
  }

  if (!pendingSocketPromise) {
    pendingSocketPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token

      if (!accessToken) {
        return null
      }

      transportSocket = io(apiOrigin(), {
        auth: {
          token: accessToken,
        },
        transports: ['websocket'],
      })

      return transportSocket
    })().finally(() => {
      pendingSocketPromise = null
    })
  }

  return pendingSocketPromise
}

export function getExistingTransportSocket() {
  return transportSocket
}
