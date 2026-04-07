import type { Request } from 'express'
import type { LocationReverseGeocodeQuery, LocationSearchQuery } from '../models/transport.schemas'
import { getTransportAccessRoles } from '../utils/role'
import {
  forwardGeocode,
  getMapProvider,
  getMapboxBudgetState,
  hasMapboxToken,
  incrementMapboxUsage,
  mapboxBudgetSnapshot,
  providerOrder,
  reverseGeocode,
  type LocationSuggestionRecord,
  type MapboxBudgetState,
  type MapProviderRole,
} from './locationService'

export type LocationAudience = 'admin' | 'driver' | 'member'
export type LocationProvider = 'mapbox' | 'osm' | 'cache'

export { getMapProvider, getMapboxBudgetState, hasMapboxToken, incrementMapboxUsage, mapboxBudgetSnapshot, providerOrder }
export type { LocationSuggestionRecord, MapboxBudgetState }

export function getLocationAudience(req: Pick<Request, 'authUser' | 'projectAccess'>): LocationAudience {
  const roles = getTransportAccessRoles(req as Request)
  if (req.projectAccess?.isOwner || roles.has('LINE_PRODUCER') || roles.has('TRANSPORT_CAPTAIN')) {
    return 'admin'
  }

  if (roles.has('DRIVER') || req.authUser?.role === 'DRIVER' || req.authUser?.projectRoleTitle === 'Driver') {
    return 'driver'
  }

  return 'member'
}

export function getLocationProviderRole(req: Pick<Request, 'authUser' | 'projectAccess'>): MapProviderRole {
  const roles = getTransportAccessRoles(req as Request)

  if (req.projectAccess?.isOwner || req.authUser?.role === 'EP') {
    return 'ADMIN'
  }

  if (roles.has('LINE_PRODUCER')) {
    return 'PRODUCER'
  }

  if (roles.has('TRANSPORT_CAPTAIN')) {
    return 'CAPTAIN'
  }

  if (roles.has('DRIVER') || req.authUser?.role === 'DRIVER' || req.authUser?.projectRoleTitle === 'Driver') {
    return 'DRIVER'
  }

  return 'MEMBER'
}

export async function reverseGeocodeLocation(query: LocationReverseGeocodeQuery, userRole: MapProviderRole) {
  return reverseGeocode(query.latitude, query.longitude, userRole)
}

export async function searchLocationSuggestions(query: LocationSearchQuery, userRole: MapProviderRole) {
  return forwardGeocode(query.query, userRole)
}
