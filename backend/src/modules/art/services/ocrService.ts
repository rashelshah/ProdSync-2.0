import { recognize } from 'tesseract.js'

export interface ReceiptOcrResult {
  success: boolean
  text: string
  extractedAmount: number
  extractedQuantity: number | null
  previewText: string
  errorMessage: string | null
}

interface AmountCandidate {
  value: number
  linePriority: number
  distance: number
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function buildPreviewText(text: string) {
  const normalized = normalizeWhitespace(text)
  if (!normalized) {
    return 'No OCR text available.'
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
}

function parseNormalizedToken(token: string) {
  const cleaned = token.replace(/[^\d.,]/g, '')
  if (!cleaned) {
    return []
  }

  const variants = new Set<number>()
  const add = (value: number) => {
    if (Number.isFinite(value) && value >= 0) {
      variants.add(Number(value.toFixed(2)))
    }
  }

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastDot > lastComma) {
      add(Number(cleaned.replace(/,/g, '')))
    } else {
      add(Number(cleaned.replace(/\./g, '').replace(',', '.')))
    }
  }

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    add(Number(cleaned.replace(/,/g, '')))
    if (/,(\d{2})$/.test(cleaned)) {
      add(Number(cleaned.replace(',', '.')))
    }
  }

  if (cleaned.includes('.') && !cleaned.includes(',')) {
    add(Number(cleaned))
    if (/\.\d{3}$/.test(cleaned)) {
      add(Number(cleaned.replace('.', '')))
    }
  }

  if (!cleaned.includes(',') && !cleaned.includes('.')) {
    const integerValue = Number(cleaned)
    add(integerValue)

    if (cleaned.length >= 4 && cleaned.endsWith('00')) {
      add(integerValue / 100)
    }

    if (cleaned.length >= 5) {
      add(integerValue / 10)
      add(integerValue / 1000)
    }
  }

  return [...variants]
}

function linePriority(line: string) {
  const normalized = line.toLowerCase()
  if (normalized.includes('grand total')) {
    return 5
  }

  if (normalized.includes('total') && !normalized.includes('subtotal')) {
    return 4
  }

  if (normalized.includes('amount due') || normalized.includes('net amount')) {
    return 4
  }

  if (normalized.includes('amount')) {
    return 3
  }

  if (normalized.includes('subtotal')) {
    return 2
  }

  return 1
}

function chooseBestCandidate(candidates: AmountCandidate[]) {
  return candidates.sort((left, right) => {
    if (right.linePriority !== left.linePriority) {
      return right.linePriority - left.linePriority
    }

    if (left.distance !== right.distance) {
      return left.distance - right.distance
    }

    return left.value - right.value
  })[0]
}

export function extractAmount(text: string, manualAmount?: number) {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  const candidates: AmountCandidate[] = []

  for (const line of lines) {
    const matches = line.match(/[\d][\d,.\s]{0,18}\d|\d/g) ?? []
    for (const token of matches) {
      for (const value of parseNormalizedToken(token)) {
        candidates.push({
          value,
          linePriority: linePriority(line),
          distance: manualAmount == null ? 0 : Math.abs(value - manualAmount),
        })
      }
    }
  }

  const filtered = candidates.filter(candidate => candidate.value > 0)
  if (filtered.length === 0) {
    return 0
  }

  if (manualAmount != null) {
    const nearby = filtered.filter(candidate => candidate.distance <= Math.max(200, manualAmount * 3))
    if (nearby.length > 0) {
      return chooseBestCandidate(nearby).value
    }
  }

  const preferred = filtered.filter(candidate => candidate.linePriority >= 3)
  if (preferred.length > 0) {
    return chooseBestCandidate(preferred).value
  }

  return chooseBestCandidate(filtered).value
}

export function extractQuantity(text: string, manualQuantity?: number) {
  const normalized = text.toLowerCase()
  const matches = [
    ...normalized.matchAll(/\b(?:qty|quantity)\s*[:x-]?\s*(\d{1,3})\b/g),
    ...normalized.matchAll(/\b(\d{1,3})\s*x\b/g),
    ...normalized.matchAll(/\bx\s*(\d{1,3})\b/g),
  ]

  if (matches.length === 0) {
    return null
  }

  const values = matches
    .map(match => Number(match[1]))
    .filter(value => Number.isInteger(value) && value > 0 && value <= 999)

  if (values.length === 0) {
    return null
  }

  if (manualQuantity != null) {
    return values.sort((left, right) => Math.abs(left - manualQuantity) - Math.abs(right - manualQuantity))[0]
  }

  return values[0]
}

export async function runReceiptOcr(
  file: Express.Multer.File,
  options?: { manualAmount?: number; manualQuantity?: number },
): Promise<ReceiptOcrResult> {
  try {
    const result = await recognize(file.buffer, 'eng')
    const text = result.data.text?.trim() ?? ''

    return {
      success: true,
      text,
      extractedAmount: extractAmount(text, options?.manualAmount),
      extractedQuantity: extractQuantity(text, options?.manualQuantity),
      previewText: buildPreviewText(text),
      errorMessage: null,
    }
  } catch (error) {
    return {
      success: false,
      text: '',
      extractedAmount: 0,
      extractedQuantity: null,
      previewText: 'OCR processing failed.',
      errorMessage: error instanceof Error ? error.message : 'OCR processing failed.',
    }
  }
}
