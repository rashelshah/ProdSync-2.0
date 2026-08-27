import { useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Globe,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import {
  FEATURE_COMPARISON,
  PRICING_FAQS,
  PRICING_PLANS,
  type PricingPlan,
} from '@/modules/landing/data/pricingConfig'
import { useLiquidTransition } from '@/context/LiquidTransitionContext'

type Currency = 'USD' | 'INR'

function PricingCard({
  plan,
  isAnnual,
  currency,
}: {
  plan: PricingPlan
  isAnnual: boolean
  currency: Currency
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { triggerLiquidNav } = useLiquidTransition()

  const price = currency === 'USD'
    ? (isAnnual ? plan.annualPriceUSD : plan.monthlyPriceUSD)
    : (isAnnual ? plan.annualPriceINR : plan.monthlyPriceINR)

  const currencySymbol = currency === 'USD' ? '$' : '₹'

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-[30px] p-6 sm:p-8 transition-all duration-300 ${
        plan.recommended
          ? 'border-2 border-orange-500/70 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-orange-500/50 dark:bg-[#110d18]/90 lg:-translate-y-2'
          : 'border border-zinc-200 bg-white/80 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.03]'
      }`}
    >
      {/* Ambient Glow */}
      {plan.recommended && (
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.18)_0%,_transparent_70%)] dark:opacity-80" />
      )}

      <div className="relative z-10 space-y-6">
        {/* Top Header & Recommended Tag */}
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            {plan.name}
          </h3>
          {plan.recommended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black shadow-sm">
              <Sparkles className="h-3 w-3" />
              {plan.recommendedLabel || 'Recommended'}
            </span>
          )}
        </div>

        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {plan.tagline}
        </p>

        {/* Dynamic Price Display */}
        <div className="border-b border-zinc-200/80 pb-4 pt-1 dark:border-white/8">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              {currencySymbol}{(price ?? 0).toLocaleString()}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              / month
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {isAnnual ? 'Billed annually' : 'Billed monthly'}
            {isAnnual && (
              <span className="ml-1.5 text-orange-600 dark:text-orange-400 font-semibold">
                (Save 20%)
              </span>
            )}
          </p>
        </div>

        {/* Benefits List */}
        <ul className="space-y-3 pt-1">
          {plan.benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200">
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-orange-500" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 space-y-4 pt-8">
        {plan.trialText ? (
          <div className="flex items-center justify-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{plan.trialText}</span>
          </div>
        ) : (
          <div className="h-6" />
        )}

        {/* Action Button using Global CTA Design Token System */}
        <button
          ref={buttonRef}
          onClick={() => triggerLiquidNav(buttonRef, '/auth')}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 active:scale-[0.99] ${
            plan.recommended
              ? 'bg-orange-500 text-black hover:-translate-y-[1px] hover:bg-orange-600 hover:shadow-md hover:shadow-orange-500/20 focus-visible:ring-orange-500/40'
              : 'border border-zinc-200 bg-white text-zinc-900 hover:-translate-y-[1px] hover:border-zinc-300 hover:bg-zinc-100 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-700 dark:hover:bg-zinc-800 focus-visible:ring-orange-500/40'
          }`}
        >
          {plan.ctaText}
        </button>
      </div>
    </div>
  )
}

function FaqItem({ faq }: { faq: typeof PRICING_FAQS[0] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-[22px] border border-zinc-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition-colors dark:border-white/8 dark:bg-white/[0.03]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none"
      >
        <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-base">
          {faq.question}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${
            isOpen ? 'rotate-180 text-orange-500' : ''
          }`}
        />
      </button>
      {isOpen && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-sm">
          {faq.answer}
        </p>
      )}
    </div>
  )
}

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true)
  const [currency, setCurrency] = useState<Currency>('USD')
  const [showComparison, setShowComparison] = useState(false)

  return (
    <section id="pricing" data-reveal className="reveal-section scroll-mt-32 pt-20 sm:pt-24 lg:pt-32">
      <div className="mx-auto max-w-[1240px]">
        {/* Section Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end mb-10 sm:mb-12">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 shadow-soft dark:border-white/8 dark:bg-white/[0.05] dark:text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Pricing &amp; Plans
            </div>

            <h2 className="text-[1.8rem] font-bold tracking-[-0.05em] text-zinc-900 dark:text-white sm:text-[2.75rem]">
              Flexible Capacity for Every <span className="animate-gradient-x bg-gradient-to-r from-orange-400 via-violet-500 to-sky-400 bg-clip-text text-transparent">Production</span>
            </h2>

            <p className="mt-3 max-w-[620px] text-[0.95rem] leading-7 text-zinc-500 dark:text-zinc-300 sm:text-[1rem]">
              Transparent pricing designed to scale with your film shoots — from independent pilots to multi-unit studio productions.
            </p>
          </div>

          {/* Billing Toggle Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Selector */}
            <div className="inline-flex rounded-full border border-zinc-200/80 bg-white/90 p-1 shadow-sm dark:border-white/8 dark:bg-white/[0.04]">
              <button
                onClick={() => setCurrency('USD')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  currency === 'USD'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                USD ($)
              </button>
              <button
                onClick={() => setCurrency('INR')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  currency === 'INR'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                INR (₹)
              </button>
            </div>

            {/* Monthly / Annual Toggle */}
            <div className="inline-flex items-center rounded-full border border-zinc-200/80 bg-white/90 p-1 shadow-sm dark:border-white/8 dark:bg-white/[0.04]">
              <button
                onClick={() => setIsAnnual(false)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  !isAnnual
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isAnnual
                    ? 'bg-orange-500 text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                  -20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-stretch lg:gap-8">
          {PRICING_PLANS.map(plan => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isAnnual={isAnnual}
              currency={currency}
            />
          ))}
        </div>

        {/* Feature Comparison Matrix Toggle */}
        <div className="mt-14 text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-900 transition-all hover:-translate-y-[1px] hover:border-zinc-300 hover:bg-zinc-100 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <span>{showComparison ? 'Hide Full Feature Comparison' : 'Compare All Features'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showComparison ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Feature Comparison Matrix Content */}
        {showComparison && (
          <div className="mt-8 overflow-hidden rounded-[30px] border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-2xl dark:border-white/8 dark:bg-[#110d18]/90">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/10">
                    <th className="pb-4 font-bold text-zinc-900 dark:text-white text-base">Features</th>
                    <th className="pb-4 text-center font-bold text-zinc-900 dark:text-white">Go</th>
                    <th className="pb-4 text-center font-bold text-orange-500">Pro (Recommended)</th>
                    <th className="pb-4 text-center font-bold text-zinc-900 dark:text-white">Pro Plus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/60 dark:divide-white/6">
                  {FEATURE_COMPARISON.map(group => (
                    <tr key={group.category} className="contents">
                      <tr className="bg-zinc-50 dark:bg-white/[0.02]">
                        <td colSpan={4} className="py-3 px-2 font-semibold uppercase tracking-wider text-[11px] text-zinc-500 dark:text-zinc-400">
                          {group.category}
                        </td>
                      </tr>
                      {group.features.map(feature => (
                        <tr key={feature.name} className="hover:bg-zinc-50/60 dark:hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-200">{feature.name}</td>
                          <td className="py-3 px-2 text-center text-zinc-600 dark:text-zinc-400">
                            {typeof feature.go === 'boolean' ? (
                              feature.go ? <Check className="mx-auto h-4 w-4 text-orange-500" /> : <span className="text-zinc-400">—</span>
                            ) : (
                              feature.go
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-semibold text-zinc-900 dark:text-white">
                            {typeof feature.pro === 'boolean' ? (
                              feature.pro ? <Check className="mx-auto h-4 w-4 text-orange-500" /> : <span className="text-zinc-400">—</span>
                            ) : (
                              feature.pro
                            )}
                          </td>
                          <td className="py-3 px-2 text-center text-zinc-600 dark:text-zinc-400">
                            {typeof feature.proPlus === 'boolean' ? (
                              feature.proPlus ? <Check className="mx-auto h-4 w-4 text-orange-500" /> : <span className="text-zinc-400">—</span>
                            ) : (
                              feature.proPlus
                            )}
                          </td>
                        </tr>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FAQs Accordion Section */}
        <div className="mt-16 sm:mt-20">
          <div className="mb-8 text-center">
            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
              Frequently Asked Questions
            </h3>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
              Everything you need to know about ProdSync plans, billing, and trial access.
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-4">
            {PRICING_FAQS.map(faq => (
              <FaqItem key={faq.question} faq={faq} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
