import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { getUserFromAccessToken } from '../services/auth.service'
import { getProjectAccess } from '../services/project-access.service'
import { env, isProduction } from '../utils/env'

export interface TransportRealtimeEventPayload {
  projectId: string
  entityId: string
  type: string
  data: unknown
}

let io: Server | null = null

function projectRoom(projectId: string) {
  return `project:${projectId}`
}

export function initializeRealtimeServer(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: isProduction() ? env.clientOrigin : true,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === 'string'
        ? socket.handshake.auth.token
        : typeof socket.handshake.headers.authorization === 'string' && socket.handshake.headers.authorization.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice('Bearer '.length)
          : null

      if (!token) {
        return next(new Error('Authentication token is required.'))
      }

      const user = await getUserFromAccessToken(token)
      socket.data.user = user
      return next()
    } catch (error) {
      return next(error instanceof Error ? error : new Error('Realtime authentication failed.'))
    }
  })

  io.on('connection', (socket) => {
    socket.on('project:subscribe', async (projectId: string, callback?: (response: { ok: boolean; error?: string }) => void) => {
      try {
        const userId = socket.data.user?.id as string | undefined
        if (!userId || !projectId) {
          callback?.({ ok: false, error: 'Project subscription is missing required context.' })
          return
        }

        const access = await getProjectAccess(projectId, userId)
        if (!access.isMember && !access.isOwner) {
          callback?.({ ok: false, error: 'Project access denied.' })
          return
        }

        await socket.join(projectRoom(projectId))
        callback?.({ ok: true })
      } catch (error) {
        callback?.({ ok: false, error: error instanceof Error ? error.message : 'Subscription failed.' })
      }
    })

    socket.on('project:unsubscribe', async (projectId: string) => {
      if (!projectId) {
        return
      }

      await socket.leave(projectRoom(projectId))
    })
  })

  return io
}

export function emitTransportEvent(eventName: 'trip_started' | 'trip_ended' | 'fuel_logged' | 'alert_created', payload: TransportRealtimeEventPayload) {
  io?.to(projectRoom(payload.projectId)).emit(eventName, payload)
}
