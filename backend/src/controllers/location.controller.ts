import type { Request, Response } from 'express'
import { getLocationProviderRole, reverseGeocodeLocation, searchLocationSuggestions } from '../services/location.service'

export async function reverseGeocodeController(req: Request, res: Response) {
  const userRole = getLocationProviderRole(req)
  const latitude = Number(req.query.latitude ?? req.query.lat)
  const longitude = Number(req.query.longitude ?? req.query.lng)
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : ''

  if (!projectId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.json({
      name: 'Location unavailable',
      address: 'Location unavailable',
      lat: Number.isFinite(latitude) ? latitude : null,
      lng: Number.isFinite(longitude) ? longitude : null,
    })
  }

  try {
    const result = await reverseGeocodeLocation({ projectId, latitude, longitude }, userRole)
    const name = result.address || 'Location unavailable'
    return res.json({
      name,
      address: name,
      lat: latitude,
      lng: longitude,
    })
  } catch (error) {
    console.warn('[transport][location][reverse] safe fallback', {
      projectId,
      latitude,
      longitude,
      error: error instanceof Error ? error.message : error,
    })
    return res.json({
      name: 'Location unavailable',
      address: 'Location unavailable',
      lat: latitude,
      lng: longitude,
    })
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
    const locations = (result.suggestions ?? []).slice(0, 5).map(item => ({
      name: item.label || item.address || 'Unnamed location',
      lat: item.location.latitude ?? null,
      lng: item.location.longitude ?? null,
    }))
    return res.json(locations)
  } catch (error) {
    console.warn('[transport][location][search] safe fallback', {
      projectId,
      query: trimmedQuery,
      error: error instanceof Error ? error.message : error,
    })
    return res.json([])
  }
}
