import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middlewares/auth'
import { authorizeRoles, requireProjectAccess } from '../../middlewares/rbac'
import { getLocationProviderRole } from '../../services/location.service'
import { asyncHandler } from '../../utils/asyncHandler'
import { getSecureDirections, getSecureMapRuntimeConfig } from './map.service'

const coordinateSchema = z.coerce.number()

const directionsQuerySchema = z.object({
  projectId: z.string().uuid(),
  fromLat: coordinateSchema.min(-90).max(90),
  fromLng: coordinateSchema.min(-180).max(180),
  toLat: coordinateSchema.min(-90).max(90),
  toLng: coordinateSchema.min(-180).max(180),
})

export const mapRouter = Router()

mapRouter.get(
  '/config',
  requireAuth,
  requireProjectAccess,
  authorizeRoles(['EP', 'LP']),
  asyncHandler(async (req, res) => {
    const userRole = getLocationProviderRole(req)
    const config = await getSecureMapRuntimeConfig(userRole)
    res.json(config)
  }),
)

mapRouter.get(
  '/directions',
  requireAuth,
  requireProjectAccess,
  authorizeRoles(['EP', 'LP']),
  asyncHandler(async (req, res) => {
    const query = directionsQuerySchema.parse(req.query)
    const userRole = getLocationProviderRole(req)
    const directions = await getSecureDirections(
      { latitude: query.fromLat, longitude: query.fromLng },
      { latitude: query.toLat, longitude: query.toLng },
      userRole,
    )

    res.setHeader('Cache-Control', 'private, max-age=60')
    res.json(directions)
  }),
)
