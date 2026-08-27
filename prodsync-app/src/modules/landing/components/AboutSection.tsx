import { Phone, Mail, Clapperboard, Building2 } from 'lucide-react'

/**
 * Compact Inline Section for the Landing Page `#about` anchor link
 */
export function AboutSection() {
  return (
    <section id="about" data-reveal className="reveal-section scroll-mt-32 pt-16 sm:pt-20 lg:pt-24">
      <div className="mx-auto max-w-[1180px]">
        {/* Section Header */}
        <div className="mb-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            About Us
          </div>
          <h2 className="text-[1.8rem] sm:text-[2.15rem] font-bold tracking-[-0.05em] text-zinc-900 dark:text-white sm:text-[2.75rem]">
            Built for <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">Seamless Production</span>
          </h2>
        </div>

        {/* Compact Card Container */}
        <div className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-white/80 p-6 sm:p-8 lg:p-10 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.03]">
          {/* Ambient Glows */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.14)_0%,_transparent_70%)] dark:opacity-80" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.12)_0%,_transparent_70%)] dark:opacity-80" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-12 lg:items-center">
            {/* Description Text */}
            <div className="space-y-4 lg:col-span-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-black shadow-md">
                  <Clapperboard className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold tracking-[-0.03em] text-zinc-900 dark:text-white sm:text-2xl">
                  ProdSync
                </span>
              </div>

              <p className="text-base sm:text-lg leading-relaxed text-zinc-700 dark:text-zinc-200">
                ProdSync is a production management platform built to simplify and organize film production workflows, from planning and crew coordination to logistics, expenses, approvals, and reporting.
              </p>

              <p className="text-sm sm:text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
                Designed to keep production teams connected, organized, and informed throughout the entire production process.
              </p>
            </div>

            {/* Separator on desktop */}
            <div className="hidden lg:col-span-1 lg:flex lg:justify-center">
              <div className="h-32 w-px bg-zinc-200 dark:bg-white/10" />
            </div>

            {/* Contact Details Card */}
            <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-5 shadow-sm dark:border-white/8 dark:bg-white/[0.03] lg:col-span-4">
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Tubelight Mediaworks
                </span>
              </div>

              <div className="space-y-3">
                <a
                  href="tel:+919176011604"
                  className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 font-medium text-zinc-800 transition-all hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-600 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Phone</div>
                    <div className="truncate text-xs sm:text-sm font-semibold">+91 91760 11604</div>
                  </div>
                </a>

                <a
                  href="mailto:dhruva@tubelightmediaworks.com"
                  className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 font-medium text-zinc-800 transition-all hover:border-orange-500/40 hover:bg-orange-500/5 hover:text-orange-600 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Email</div>
                    <div className="truncate text-xs sm:text-sm font-semibold">dhruva@tubelightmediaworks.com</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
