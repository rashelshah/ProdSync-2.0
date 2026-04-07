import type { Request, Response } from 'express'
import { trackingLiveQuerySchema, trackingMapQuerySchema } from '../models/transport.schemas'
import { listLiveVehicleLocationsForActor, buildTrackingMapImageForActor, getTrackingLiveMetaForRoles } from '../services/tracking.service'
import { getTransportAccessRoles } from '../utils/role'

export async function getLiveTrackingController(req: Request, res: Response) {
  const roles = getTransportAccessRoles(req)
  const meta = await getTrackingLiveMetaForRoles(roles)

  try {
    const query = trackingLiveQuerySchema.parse(req.query)
    const locations = await listLiveVehicleLocationsForActor(query, req.authUser?.id ?? null, roles)
    return res.json({ data: locations, meta })
  } catch (error) {
    console.warn('[tracking][live] safe fallback', {
      query: req.query,
      error: error instanceof Error ? error.message : error,
    })
    return res.json({
      data: [],
      meta: {
        ...meta,
        fallbackActive: true,
      },
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
