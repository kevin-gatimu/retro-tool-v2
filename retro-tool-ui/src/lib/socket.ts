import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { env } from '#/env'
import { getBearerToken } from './auth-client'

let notificationSocket: Socket | null = null
let retroSocket: Socket | null = null
let estimateSocket: Socket | null = null
let icebreakerSocket: Socket | null = null
let standupSocket: Socket | null = null

const SOCKET_OPTS = {
  // Bearer token (primary) — the API validates it via Better Auth's getSession.
  // A function so reconnects re-read the current token. `withCredentials` keeps
  // the cookie as a fallback during the cookie→bearer rollout; the server
  // accepts either. Returns undefined when no token yet → cookie covers it.
  auth: (cb: (data: Record<string, unknown>) => void) => {
    cb({ token: getBearerToken() ?? undefined })
  },
  withCredentials: true,
  autoConnect: false,
  transports: ['websocket', 'polling'] as string[],
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
}

export function getNotificationSocket(): Socket {
  if (!notificationSocket) {
    notificationSocket = io(`${env.VITE_API_URL}/notifications`, SOCKET_OPTS)
  }
  return notificationSocket
}

export function getRetroSocket(): Socket {
  if (!retroSocket) {
    retroSocket = io(`${env.VITE_API_URL}/retros`, SOCKET_OPTS)
  }
  return retroSocket
}

export function getEstimateSocket(): Socket {
  if (!estimateSocket) {
    estimateSocket = io(`${env.VITE_API_URL}/estimates`, SOCKET_OPTS)
  }
  return estimateSocket
}

export function getIcebreakerSocket(): Socket {
  if (!icebreakerSocket) {
    icebreakerSocket = io(`${env.VITE_API_URL}/icebreakers`, SOCKET_OPTS)
  }
  return icebreakerSocket
}

export function getStandupSocket(): Socket {
  if (!standupSocket) {
    standupSocket = io(`${env.VITE_API_URL}/standups`, SOCKET_OPTS)
  }
  return standupSocket
}
