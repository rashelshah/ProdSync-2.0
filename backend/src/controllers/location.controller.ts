import type { Request, Response } from 'express'
import { locationReverseGeocodeQuerySchema, locationSearchQuerySchema } from '../models/transport.schemas'
import { getLocationAudience, reverseGeocodeLocation, searchLocationSuggestions } from '../services/location.service'

export async function reverseGeocodeController(req: Request, res: Response) {
  const query = locationReverseGeocodeQuerySchema.parse(req.query)
  const audience = getLocationAudience(req)
  const result = await reverseGeocodeLocation(query, audience)

  res.json(result)
}

export async function searchLocationSuggestionsController(req: Request, res: Response) {
  const query = locationSearchQuerySchema.parse(req.query)
  const audience = getLocationAudience(req)
  const result = await searchLocationSuggestions(query, audience)

  res.json(result)
}
