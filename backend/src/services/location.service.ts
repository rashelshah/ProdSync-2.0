import type { Request } from 'express'
import type { LocationReverseGeocodeQuery, LocationSearchQuery } from '../models/transport.schemas'
import { getTransportAccessRoles } from '../utils/role'
import {
  forwardGeocode,
  getMapboxBudgetState,
  incrementMapboxUsage,
  mapboxBudgetSnapshot,
  providerOrder,
  reverseGeocode,
  type LocationSuggestionRecord,
  type MapboxBudgetState,
} from './locationService'

export type LocationAudience = 'admin' | 'driver' | 'member'
export type LocationProvider = 'mapbox' | 'osm' | 'cache'

export { getMapboxBudgetState, incrementMapboxUsage, mapboxBudgetSnapshot, providerOrder }
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

export async function reverseGeocodeLocation(query: LocationReverseGeocodeQuery, _audience: LocationAudience) {
  return reverseGeocode(query.latitude, query.longitude)
}

export async function searchLocationSuggestions(query: LocationSearchQuery, _audience: LocationAudience) {
  return forwardGeocode(query.query)
}
