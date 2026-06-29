import { env } from '#/env'
import { getBearerToken } from './auth-client'

const API_BASE_URL = env.VITE_API_URL

async function apiFetch<T = {}>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  // Build headers with optional bearer token for private window fallback
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Attach the bearer token whenever we have one — it's the primary credential.
  // `credentials:'include'` below keeps the cookie as a fallback during rollout.
  const token = getBearerToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    method,
    headers,
    credentials: 'include',
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { message?: string }).message ||
        `HTTP ${response.status}: ${response.statusText}`,
    )
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export const api = {
  get: <T = {}>(url: string) => apiFetch<T>('GET', url),
  post: <T = {}>(url: string, body?: unknown) => apiFetch<T>('POST', url, body),
  patch: <T = {}>(url: string, body?: unknown) =>
    apiFetch<T>('PATCH', url, body),
  put: <T = {}>(url: string, body?: unknown) => apiFetch<T>('PUT', url, body),
  delete: <T = {}>(url: string) => apiFetch<T>('DELETE', url),
}
