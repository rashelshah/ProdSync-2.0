import { supabase } from './supabase'

function normalizeApiBaseUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, '')
  return trimmed || '/api'
}

export const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

export function apiOrigin() {
  if (typeof window === 'undefined') {
    return apiBaseUrl.replace(/\/api\/?$/, '')
  }

  return new URL(apiBaseUrl, window.location.origin).origin
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  const headers = new Headers(init.headers)
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData
  const method = init.method ?? 'GET'

  if (!headers.has('Content-Type') && init.body && !isFormDataBody) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  console.log('[apiFetch] request', {
    method,
    path,
    url: `${apiBaseUrl}${path}`,
    hasBody: Boolean(init.body),
    isFormDataBody,
    hasAccessToken: Boolean(accessToken),
  })

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  console.log('[apiFetch] response', {
    method,
    path,
    status: response.status,
    ok: response.ok,
  })

  return response
}

export async function readApiJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(errorPayload?.error ?? `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}
