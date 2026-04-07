import toast, { type ToastOptions } from 'react-hot-toast'

export type AppToastOptions = ToastOptions

export function showSuccess(message: string, options?: AppToastOptions) {
  return toast.success(message, options)
}

export function showError(message: string, options?: AppToastOptions) {
  return toast.error(message, options)
}

export function showLoading(message: string, options?: AppToastOptions) {
  return toast.loading(message, options)
}

export function showInfo(message: string, options?: AppToastOptions) {
  return toast(message, options)
}

export function dismissToast(toastId?: string) {
  toast.dismiss(toastId)
}

export function resolveErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message
  }

  return fallback
}
