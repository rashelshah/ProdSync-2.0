import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useProjectsStore } from '@/features/projects/projects.store'
import type { ProjectCurrency } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyLocaleMap: Record<ProjectCurrency, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
}

export function formatCurrency(amount: number, currency = useProjectsStore.getState().activeProjectCurrency) {
  const resolvedCurrency = currencyLocaleMap[currency as ProjectCurrency] ? (currency as ProjectCurrency) : 'INR'
  return new Intl.NumberFormat(currencyLocaleMap[resolvedCurrency], {
    style: 'currency',
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function timeAgo(date: Date | string | number): string {
  const normalized = date instanceof Date ? date : new Date(date)
  const seconds = Math.floor((Date.now() - normalized.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function getPercentColor(percent: number): string {
  if (percent >= 90) return 'text-red-400'
  if (percent >= 75) return 'text-amber-400'
  return 'text-emerald-400'
}
