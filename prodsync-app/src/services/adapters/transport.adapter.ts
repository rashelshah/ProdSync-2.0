import type { FuelLog, Trip, FuelLogUI, TripUI, TransportKpis, Vehicle } from '@/types'

/**
 * Compute fuel efficiency rating from actual vs expected mileage
 */
export function computeFuelEfficiency(expected: number, actual: number) {
  const diff = ((expected - actual) / expected) * 100
  if (diff > 20) return { rating: 'critical' as const, mismatchPercent: diff }
  if (diff > 10) return { rating: 'warning' as const, mismatchPercent: diff }
  return { rating: 'good' as const, mismatchPercent: diff }
}

/**
 * Transform raw FuelLog from service into UI-ready shape
 */
export function transformFuelLog(log: FuelLog): FuelLogUI {
  const { rating, mismatchPercent } = computeFuelEfficiency(log.expectedMileage, log.actualMileage)
  return {
    ...log,
    mismatchPercent,
    efficiencyRating: rating,
  }
}

/**
 * Transform raw Trip into UI-ready shape with computed labels
 */
export function transformTripForUI(trip: Trip): TripUI {
  const statusLabel =
    trip.status === 'active' ? 'Active' :
    trip.status === 'completed' ? 'Completed' : 'Flagged'

  const durationLabel = trip.endTime
    ? `${trip.startTime} — ${trip.endTime}`
    : `${trip.startTime} — Live`

  return { ...trip, durationLabel, statusLabel }
}

/**
 * Aggregate raw trips/vehicles into Transport KPIs
 */
export function mapTransportKpis(
  trips: Trip[],
  fuelLogs: FuelLog[],
  vehicles: Vehicle[] = []
): TransportKpis {
  const activeVehicles = vehicles.length || new Set(trips.map(trip => trip.vehicleId)).size
  const inTransit = trips.filter(t => t.status === 'active').length
  const idleVehicles = Math.max(activeVehicles - inTransit, 0)
  const tripsToday = trips.length
  const totalDistanceKm = trips.reduce((sum, t) => sum + t.distanceKm, 0)
  const fuelCost = fuelLogs.reduce((sum, l) => sum + l.litres * 1.12, 0) // $1.12/L
  const hasMismatch = fuelLogs.some(l => {
    const { rating } = computeFuelEfficiency(l.expectedMileage, l.actualMileage)
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
