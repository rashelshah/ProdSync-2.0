export type SupportedCurrency = 'INR' | 'USD' | 'EUR'

const localeByCurrency: Record<SupportedCurrency, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
}

export function formatCurrency(amount: number, currency: SupportedCurrency = 'INR') {
  return new Intl.NumberFormat(localeByCurrency[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}
