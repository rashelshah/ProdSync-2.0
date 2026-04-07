import type { Request, Response } from 'express'
import { getLocationProviderRole, reverseGeocodeLocation, searchLocationSuggestions } from '../services/location.service'

export async function reverseGeocodeController(req: Request, res: Response) {
  const userRole = getLocationProviderRole(req)
  const latitude = Number(req.query.latitude ?? req.query.lat)
  const longitude = Number(req.query.longitude ?? req.query.lng)
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : ''

  if (!projectId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.json({ address: 'Location unavailable' })
  }

  try {
    const result = await reverseGeocodeLocation({ projectId, latitude, longitude }, userRole)
    return res.json({ address: result.address || 'Location unavailable' })
  } catch (error) {
    console.warn('[transport][location][reverse] safe fallback', {
      projectId,
      latitude,
      longitude,
      error: error instanceof Error ? error.message : error,
    })
    return res.json({ address: 'Location unavailable' })
  }
}

export async function searchLocationSuggestionsController(req: Request, res: Response) {
  const userRole = getLocationProviderRole(req)
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : ''
  const query = typeof req.query.query === 'string'
    ? req.query.query
    : typeof req.query.q === 'string'
      ? req.query.q
      : ''
  const trimmedQuery = (query || '').trim()

  if (!projectId || trimmedQuery.length < 2) {
    return res.json({ suggestions: [] })
  }

  try {
    const result = await searchLocationSuggestions({ projectId, query: trimmedQuery }, userRole)
    return res.json({ suggestions: result.suggestions ?? [] })
  } catch (error) {
    console.warn('[transport][location][search] safe fallback', {
      projectId,
      query: trimmedQuery,
      error: error instanceof Error ? error.message : error,
    })
    return res.json({ suggestions: [] })
  }
}
