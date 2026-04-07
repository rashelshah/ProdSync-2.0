import type { Request, Response } from 'express'
import { trackingLiveQuerySchema, trackingMapQuerySchema } from '../models/transport.schemas'
import { hasMapboxToken } from '../services/location.service'
import { listLiveVehicleLocationsForActor, buildTrackingMapImageForActor, getTrackingLiveMetaForRoles } from '../services/tracking.service'
import { getTransportAccessRoles } from '../utils/role'

export async function getLiveTrackingController(req: Request, res: Response) {
  try {
    const roles = getTransportAccessRoles(req)
    const meta = await getTrackingLiveMetaForRoles(roles)
    const query = trackingLiveQuerySchema.parse(req.query)
    const locations = await listLiveVehicleLocationsForActor(query, req.authUser?.id ?? null, roles)
    const mapboxEnabled = hasMapboxToken()
    return res.json({
      data: locations,
      vehicles: locations,
      meta,
      mapEnabled: mapboxEnabled,
      provider: mapboxEnabled ? 'mapbox' : 'osm',
      fallback: !mapboxEnabled,
    })
  } catch (error) {
    console.warn('[tracking][live] safe fallback', {
      query: req.query,
      error: error instanceof Error ? error.message : error,
    })

    return res.json({
      data: [],
      vehicles: [],
      meta: {
        mapEnabled: false,
        provider: 'osm',
        mode: 'fallback',
        fallback: true,
        reason: 'Fallback active',
        mapboxMode: 'disabled',
        mapboxEnabledForAdmin: false,
        fallbackActive: true,
      },
      mapEnabled: false,
      provider: 'osm',
      fallback: true,
    })
  }
}

export async function getTrackingMapImageController(req: Request, res: Response) {
  const query = trackingMapQuerySchema.parse(req.query)
  const roles = getTransportAccessRoles(req)
  const image = await buildTrackingMapImageForActor(query, req.authUser?.id ?? null, roles)

  res.setHeader('Content-Type', image.contentType)
  res.setHeader('Cache-Control', 'private, max-age=60')
  res.send(image.body)
}
