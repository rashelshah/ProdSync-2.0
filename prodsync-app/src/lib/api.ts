import { supabase } from './supabase'
import { showError } from './toast'

type ApiResponse = Response & {
  requestMethod?: string
}

type HandledApiError = Error & {
  feedbackShown?: boolean
  status?: number
}

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

function annotateError(message: string, options?: { feedbackShown?: boolean; status?: number }) {
  const error = new Error(message) as HandledApiError
  error.feedbackShown = options?.feedbackShown ?? false
  error.status = options?.status
  return error
}

function getToastKey(prefix: string, value: string) {
  return `${prefix}:${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 80)}`
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  const headers = new Headers(init.headers)
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData
  const method = init.method ?? 'GET'
  const shouldLog = import.meta.env.DEV

  if (!headers.has('Content-Type') && init.body && !isFormDataBody) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (shouldLog) {
    console.log('[apiFetch] request', {
      method,
      path,
      url: `${apiBaseUrl}${path}`,
      hasBody: Boolean(init.body),
      isFormDataBody,
      hasAccessToken: Boolean(accessToken),
    })
  }

  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach the server.'
    showError('Unable to reach the server. Please try again.', { id: 'network-error' })
    throw annotateError(message, { feedbackShown: true })
  }

  if (shouldLog) {
    console.log('[apiFetch] response', {
      method,
      path,
      status: response.status,
      ok: response.ok,
    })
  }

  return Object.assign(response, { requestMethod: method }) as ApiResponse
}

export async function readApiJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null) as { error?: string; message?: string } | null
    const message = errorPayload?.error ?? errorPayload?.message ?? `Request failed with status ${response.status}`
    const requestMethod = (response as ApiResponse).requestMethod?.toUpperCase()
    const shouldToast = !requestMethod || requestMethod === 'GET' || requestMethod === 'HEAD'

    if (shouldToast) {
      showError(message, {
        id: getToastKey('api-error', `${requestMethod ?? 'request'}-${response.url}-${response.status}`),
      })
    }

    throw annotateError(message, {
      feedbackShown: shouldToast,
      status: response.status,
    })
  }

  return response.json() as Promise<T>
}
