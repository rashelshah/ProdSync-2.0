import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AppRouter } from './app/router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteTransitionIndicator } from './components/layout/RouteTransitionIndicator'
import { ThemeProvider } from './components/theme/ThemeProvider'
import { useTheme } from './components/theme/ThemeProvider'
import { useAuthStore } from './features/auth/auth.store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AppToaster() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Toaster
      position="top-right"
      gutter={8}
      containerStyle={{
        top: 16,
        right: 16,
        left: 16,
      }}
      toastOptions={{
        duration: 4000,
        style: {
          background: isDark ? 'rgba(17, 17, 17, 0.96)' : 'rgba(255, 255, 255, 0.96)',
          color: isDark ? '#ffffff' : '#18181b',
          borderRadius: '18px',
          padding: '12px 16px',
          fontSize: '14px',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(228,228,231,0.9)',
          boxShadow: isDark ? '0 20px 44px rgba(0,0,0,0.34)' : '0 18px 36px rgba(15,23,42,0.08)',
          backdropFilter: 'blur(18px)',
          maxWidth: 'min(420px, calc(100vw - 32px))',
        },
        success: {
          iconTheme: {
            primary: '#f97316',
            secondary: isDark ? '#111111' : '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: isDark ? '#111111' : '#ffffff',
          },
        },
      }}
    />
  )
}

function App() {
  const initializeAuth = useAuthStore(state => state.initializeAuth)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppToaster />
        <BrowserRouter>
          <RouteTransitionIndicator />
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
