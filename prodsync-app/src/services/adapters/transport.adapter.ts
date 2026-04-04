import type { FuelLog, FuelLogUI, Trip, TripUI, TransportKpis, Vehicle } from '@/modules/transport/types'

export function computeFuelEfficiency(expected: number, actual: number) {
  if (!expected || expected <= 0) {
    return { rating: 'good' as const, mismatchPercent: 0 }
  }

  const diff = ((expected - actual) / expected) * 100
  if (diff > 20) return { rating: 'critical' as const, mismatchPercent: diff }
  if (diff > 10) return { rating: 'warning' as const, mismatchPercent: diff }
  return { rating: 'good' as const, mismatchPercent: diff }
}

export function transformFuelLog(log: FuelLog): FuelLogUI {
  const { rating, mismatchPercent } = computeFuelEfficiency(log.expectedMileage, log.actualMileage)
  return {
    ...log,
    mismatchPercent,
    efficiencyRating: rating,
  }
}

export function transformTripForUI(trip: Trip): TripUI {
  const statusLabel =
    trip.status === 'active' ? 'Active' :
    trip.status === 'completed' ? 'Completed' :
    trip.status === 'planned' ? 'Planned' :
    trip.status === 'cancelled' ? 'Cancelled' :
    'Flagged'

  const durationLabel = trip.durationMinutes != null
    ? `${trip.durationMinutes} min`
    : trip.endTime
      ? '0 min'
      : 'Live'

  return {
    ...trip,
    durationLabel,
    statusLabel,
    idleLabel: trip.idleMinutes != null ? `${trip.idleMinutes} min` : '-',
  }
}

export function mapTransportKpis(
  trips: Trip[],
  fuelLogs: FuelLog[],
  vehicles: Vehicle[] = [],
): TransportKpis {
  const inTransitVehicleIds = new Set(trips.filter(trip => trip.status === 'active').map(trip => trip.vehicleId))
  const activeVehicles = vehicles.filter(vehicle => vehicle.status === 'active' || inTransitVehicleIds.has(vehicle.id)).length || new Set(trips.map(trip => trip.vehicleId)).size
  const inTransit = trips.filter(trip => trip.status === 'active').length
  const idleVehicles = vehicles.filter(vehicle => vehicle.status === 'idle' && !inTransitVehicleIds.has(vehicle.id)).length || Math.max(activeVehicles - inTransit, 0)
  const today = new Date().toDateString()
  const tripsToday = trips.filter(trip => new Date(trip.startTime).toDateString() === today).length
  const totalDistanceKm = trips.reduce((sum, trip) => sum + trip.distanceKm, 0)
  const fuelCost = fuelLogs.reduce((sum, log) => sum + (log.cost ?? 0), 0)
  const hasMismatch = fuelLogs.some(log => {
    const { rating } = computeFuelEfficiency(log.expectedMileage, log.actualMileage)
    return rating === 'critical'
  })

  return {
    activeVehicles,
    inTransit,
    idleVehicles,
    tripsToday,
    totalDistanceKm,
    fuelCost: Math.round(fuelCost * 100) / 100,
    fuelBurnStatus: hasMismatch ? 'critical' : fuelCost > 3000 ? 'warning' : 'ok',
  }
}
