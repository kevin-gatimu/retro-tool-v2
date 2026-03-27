import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { env } from '#/env'

let notificationSocket: Socket | null = null
let retroSocket: Socket | null = null
let estimateSocket: Socket | null = null

const SOCKET_OPTS = {
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
