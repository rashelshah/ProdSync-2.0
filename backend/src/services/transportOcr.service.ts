import fs from 'node:fs/promises'
import { recognize } from 'tesseract.js'

export interface OdometerValidationResult {
  success: boolean
  text: string
  previewText: string
  extractedOdometerKm: number | null
  manualOdometerKm: number | null
  deltaKm: number | null
  marginKm: number
  withinMargin: boolean | null
  flagged: boolean
  errorMessage: string | null
  extractionSource: 'tesseract'
}

interface Candidate {
  value: number
  score: number
  distance: number
}

function previewText(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 'No OCR text available.'
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
}

function normalizeNumericCandidate(token: string) {
  const cleaned = token.replace(/[^\d.,]/g, '')
  if (!cleaned) {
    return []
  }

  const digitsOnly = cleaned.replace(/[^\d]/g, '')
  if (digitsOnly.length < 3 || digitsOnly.length > 8) {
    return []
  }

  const candidates = new Set<number>()
  const asInteger = Number(digitsOnly)

  if (Number.isFinite(asInteger)) {
    candidates.add(asInteger)
  }

  if (cleaned.includes('.')) {
    const decimalValue = Number(cleaned.replace(/,/g, ''))
    if (Number.isFinite(decimalValue)) {
      candidates.add(Math.round(decimalValue))
    }
  }

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const decimalValue = Number(cleaned.replace(',', '.'))
    if (Number.isFinite(decimalValue)) {
      candidates.add(Math.round(decimalValue))
    }
  }

  return [...candidates].filter(value => value >= 100 && value <= 10_000_000)
}

function lineScore(line: string) {
  const normalized = line.toLowerCase()
  let score = 0

  if (normalized.includes('odo') || normalized.includes('odometer')) {
    score += 5
  }

  if (normalized.includes('km')) {
    score += 3
  }

  if (normalized.includes('trip')) {
    score -= 2
  }

  return score
}

export function extractOdometerKm(text: string, manualOdometerKm?: number | null) {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  const candidates: Candidate[] = []

  for (const line of lines) {
    const score = lineScore(line)
    const matches = line.match(/\d[\d.,\s]{2,12}\d|\d{3,8}/g) ?? []

    for (const match of matches) {
      for (const value of normalizeNumericCandidate(match)) {
        candidates.push({
          value,
          score,
          distance: manualOdometerKm == null ? 0 : Math.abs(value - manualOdometerKm),
        })
      }
    }
  }

  if (candidates.length === 0) {
    return null
  }

  const sorted = candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    if (left.distance !== right.distance) {
      return left.distance - right.distance
    }

    return right.value - left.value
  })

  return sorted[0]?.value ?? null
}

export async function validateOdometerImage(params: {
  file: Express.Multer.File
  manualOdometerKm?: number | null
  marginKm?: number
}) {
  const marginKm = params.marginKm ?? 7

  try {
    const buffer = params.file.buffer ?? await fs.readFile(params.file.path)
    const result = await recognize(buffer, 'eng')
    const text = result.data.text?.trim() ?? ''
    const extractedOdometerKm = extractOdometerKm(text, params.manualOdometerKm)
    const deltaKm = extractedOdometerKm != null && params.manualOdometerKm != null
      ? Math.abs(extractedOdometerKm - params.manualOdometerKm)
      : null
    const withinMargin = deltaKm == null ? null : deltaKm <= marginKm

    return {
      success: true,
      text,
      previewText: previewText(text),
      extractedOdometerKm,
      manualOdometerKm: params.manualOdometerKm ?? null,
      deltaKm,
      marginKm,
      withinMargin,
      flagged: withinMargin === false,
      errorMessage: null,
      extractionSource: 'tesseract' as const,
    } satisfies OdometerValidationResult
  } catch (error) {
    return {
      success: false,
      text: '',
      previewText: 'OCR processing failed.',
      extractedOdometerKm: null,
      manualOdometerKm: params.manualOdometerKm ?? null,
      deltaKm: null,
      marginKm,
      withinMargin: null,
      flagged: false,
      errorMessage: error instanceof Error ? error.message : 'OCR processing failed.',
      extractionSource: 'tesseract' as const,
    } satisfies OdometerValidationResult
  }
}
