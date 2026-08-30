import { Link } from 'react-router-dom'
import { Clapperboard } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'

/**
 * NotFoundPage — rendered by the SPA router for unknown client-side routes.
 * This provides the in-app 404 UX for authenticated users.
 *
 * NOTE: Real HTTP 404 responses for crawlers are handled by:
 *   - public/404.html (Vercel static file)
 *   - Explicit route rewrites in vercel.json
 */
export function NotFoundPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="landing-shell min-h-screen flex flex-col">
      {/* Background effects matching landing page */}
      <div className="pointer-events-none absolute inset-0 hidden opacity-70 dark:block landing-grid" />
      <div className="landing-glow pointer-events-none absolute left-1/2 top-20 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.24)_0%,_rgba(249,115,22,0.2)_42%,_transparent_72%)] dark:opacity-100" />

      {/* Nav */}
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between rounded-full border border-zinc-200/80 bg-white/75 px-4 py-3 shadow-soft backdrop-blur-xl dark:border-white/6 dark:bg-white/[0.03]">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black">
              <Clapperboard className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-[-0.03em] text-zinc-900 dark:text-white">ProdSync</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-orange-200 hover:text-orange-500 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:border-orange-500/30 dark:hover:text-orange-400"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span className="material-symbols-outlined text-[18px]">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
            </button>
            <Link
              to="/auth"
              className="inline-flex items-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black glow-button"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[520px] text-center">
          {/* 404 number */}
          <p
            className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent font-extrabold leading-none"
            style={{ fontSize: 'clamp(6rem, 22vw, 10rem)', letterSpacing: '-0.05em' }}
            aria-hidden="true"
          >
            404
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-900 dark:text-white sm:text-3xl">
            Page Not Found
          </h1>

          <p className="mt-4 max-w-[380px] mx-auto text-[0.95rem] leading-7 text-zinc-500 dark:text-zinc-400">
            The page you're looking for doesn't exist or has been moved. Head back home or explore the public pages below.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="glow-button inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-black"
            >
              ← Back to Home
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center rounded-full border border-zinc-200 bg-white/90 px-6 py-3 text-sm font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
            >
              View Pricing
            </Link>
          </div>

          {/* Quick public links */}
          <nav className="mt-10 flex flex-wrap items-center justify-center gap-5 text-sm text-zinc-400" aria-label="Public pages">
            <Link to="/about" className="transition-colors hover:text-orange-500 dark:hover:text-orange-400">About</Link>
            <Link to="/contact" className="transition-colors hover:text-orange-500 dark:hover:text-orange-400">Contact</Link>
            <Link to="/privacy" className="transition-colors hover:text-orange-500 dark:hover:text-orange-400">Privacy</Link>
            <a href="/sitemap.xml" className="transition-colors hover:text-orange-500 dark:hover:text-orange-400">Sitemap</a>
          </nav>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 px-4 py-6 text-center text-sm text-zinc-400 dark:border-white/6">
        <p>© {new Date().getFullYear()} ProdSync. All rights reserved.</p>
      </footer>
    </div>
  )
}
