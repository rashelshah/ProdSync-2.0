import { Component, type ErrorInfo, type ReactNode } from 'react'
import { showError } from '@/lib/toast'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    showError('Unexpected error occurred', { id: 'runtime-error' })
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-white">
          <div className="w-full max-w-lg rounded-[2rem] border border-zinc-200 bg-white/92 p-8 text-center shadow-soft backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/92">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
              <span className="material-symbols-outlined text-[34px]">error_outline</span>
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-zinc-900 dark:text-white">
              Something went wrong.
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Please refresh.
            </p>
            <div className="mt-8 flex justify-center">
              <button onClick={this.handleRefresh} className="btn-primary px-5 py-3">
                Refresh App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
