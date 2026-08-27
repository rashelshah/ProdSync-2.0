export interface PricingPlan {
  id: string
  name: string
  tagline: string
  projectLimit: number
  departmentLimit: number
  trialDays?: number
  trialText?: string
  pricePlaceholder: string
  monthlyPriceUSD?: number
  annualPriceUSD?: number
  monthlyPriceINR?: number
  annualPriceINR?: number
  recommended?: boolean
  recommendedLabel?: string
  ctaText: string
  benefits: string[]
}

export interface FeatureCategory {
  category: string
  features: Array<{
    name: string
    go: string | boolean
    pro: string | boolean
    proPlus: string | boolean
  }>
}

export interface PricingFaq {
  question: string
  answer: string
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'go',
    name: 'Go',
    tagline: 'Entry-level plan for smaller productions and teams.',
    projectLimit: 2,
    departmentLimit: 4,
    trialDays: 14,
    trialText: '14-day free trial',
    pricePlaceholder: 'Coming Soon',
    monthlyPriceUSD: 29,
    annualPriceUSD: 24,
    monthlyPriceINR: 2499,
    annualPriceINR: 1999,
    recommended: false,
    ctaText: 'Start Free Trial',
    benefits: [
      'Manage up to 2 active projects',
      'Select up to 4 departments per project',
      'Select departments tailored to your requirements',
      'Core ProdSync production management workflow',
      'Suitable for smaller productions and teams',
      'Includes 14-day free trial',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Designed for growing production teams and active projects.',
    projectLimit: 5,
    departmentLimit: 6,
    trialDays: 14,
    trialText: 'Popular Choice',
    pricePlaceholder: 'Coming Soon',
    monthlyPriceUSD: 79,
    annualPriceUSD: 64,
    monthlyPriceINR: 6499,
    annualPriceINR: 5199,
    recommended: true,
    recommendedLabel: 'Recommended',
    ctaText: 'Choose Pro',
    benefits: [
      'Manage up to 5 active projects',
      'Select up to 6 departments per project',
      'Select departments tailored to your requirements',
      'Suitable for growing production teams',
      'Expanded project and department capacity',
      'Full Multi-Department synchronization',
    ],
  },
  {
    id: 'pro-plus',
    name: 'Pro Plus',
    tagline: 'Maximum capacity for larger production teams and organizations.',
    projectLimit: 15,
    departmentLimit: 12,
    pricePlaceholder: 'Coming Soon',
    monthlyPriceUSD: 199,
    annualPriceUSD: 159,
    monthlyPriceINR: 15999,
    annualPriceINR: 12799,
    recommended: false,
    ctaText: 'Choose Pro Plus',
    benefits: [
      'Manage up to 15 active projects',
      'Select up to 12 departments per project',
      'Select departments tailored to your requirements',
      'Designed for larger productions with broad needs',
      'Highest project and department capacity',
      'All department modules unlocked',
    ],
  },
]

export const FEATURE_COMPARISON: FeatureCategory[] = [
  {
    category: 'Core Capacity',
    features: [
      { name: 'Active Projects', go: '2 Projects', pro: '5 Projects', proPlus: '15 Projects' },
      { name: 'Departments per Project', go: 'Up to 4', pro: 'Up to 6', proPlus: 'Up to 12' },
      { name: 'User & Crew Roles', go: 'Unlimited', pro: 'Unlimited', proPlus: 'Unlimited' },
      { name: 'Free Trial', go: '14 Days', pro: '—', proPlus: '—' },
    ],
  },
  {
    category: 'Department Modules',
    features: [
      { name: 'Camera & QR Inventory', go: true, pro: true, proPlus: true },
      { name: 'Art & Props Master', go: true, pro: true, proPlus: true },
      { name: 'Transport & Fleet Logistics', go: false, pro: true, proPlus: true },
      { name: 'Crew Payroll & Geofencing', go: false, pro: true, proPlus: true },
      { name: 'Accommodation & Hotels', go: false, pro: true, proPlus: true },
      { name: 'Food & Beverages / Catering', go: true, pro: true, proPlus: true },
      { name: 'Wardrobe & Laundry Control', go: false, pro: true, proPlus: true },
      { name: 'Cast & Junior Coordinators', go: true, pro: true, proPlus: true },
    ],
  },
  {
    category: 'Decision Engine & Approvals',
    features: [
      { name: 'Multi-Level Expense Approvals', go: 'Basic', pro: 'Advanced', proPlus: 'Custom Thresholds' },
      { name: 'PDF & CSV Financial Reports', go: true, pro: true, proPlus: true },
      { name: 'Audit Logs & Version History', go: false, pro: true, proPlus: true },
      { name: 'Permissions Checklist', go: true, pro: true, proPlus: true },
    ],
  },
]

export const PRICING_FAQS: PricingFaq[] = [
  {
    question: 'What is ProdSync?',
    answer: 'ProdSync is a production management platform designed to help film production teams organize planning, departments, crew, expenses, logistics, approvals, and reporting in one place.',
  },
  {
    question: 'What is included in the Go plan?',
    answer: 'Go supports up to 2 projects with up to 4 selected departments per project and includes a 14-day free trial.',
  },
  {
    question: 'What is included in the Pro plan?',
    answer: 'Pro supports up to 5 projects with up to 6 selected departments per project.',
  },
  {
    question: 'What is included in Pro Plus?',
    answer: 'Pro Plus supports up to 15 projects with up to 12 selected departments per project.',
  },
  {
    question: 'Can I choose which departments I need?',
    answer: 'Yes. Department limits refer to the number of departments you choose to use for each project.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes. The Go plan includes a 14-day free trial.',
  },
  {
    question: 'Can I change my plan later?',
    answer: 'Plan changes can be supported according to the subscription options available when billing is implemented.',
  },
]
