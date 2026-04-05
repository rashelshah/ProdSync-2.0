import { adminClient } from '../config/supabaseClient'
import type { FraudAssessment } from '../models/transport.types'

function roundNumber(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export async function assessFuelFraud(params: {
  projectId: string
  vehicleId: string
  tripId: string | null
  liters: number
  expectedMileage?: number | null
}): Promise<FraudAssessment> {
  const [{ data: trip }, { data: settings }] = await Promise.all([
    params.tripId
      ? adminClient
          .from('trips')
          .select('distance_km')
          .eq('id', params.tripId)
          .eq('project_id', params.projectId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    adminClient
      .from('project_settings')
      .select('fuel_allowance_per_km')
      .eq('project_id', params.projectId)
      .maybeSingle(),
  ])

  const distanceKm = trip?.distance_km ? Number(trip.distance_km) : null
  const derivedExpectedMileage = params.expectedMileage ?? (settings?.fuel_allowance_per_km ? 1 / Number(settings.fuel_allowance_per_km) : null)

  if (!distanceKm || distanceKm <= 0) {
    if (params.liters >= 10) {
      return {
        status: 'FRAUD',
        score: 95,
        reason: 'Fuel was logged without a measurable trip distance.',
        actualMileage: 0,
        expectedMileage: derivedExpectedMileage,
        variancePercent: 100,
      }
    }

    return {
      status: 'SUSPICIOUS',
      score: 55,
      reason: 'Trip distance is unavailable, so fuel efficiency could not be verified fully.',
      actualMileage: null,
      expectedMileage: derivedExpectedMileage,
      variancePercent: null,
    }
  }

  const actualMileage = roundNumber(distanceKm / params.liters)
  if (!derivedExpectedMileage || derivedExpectedMileage <= 0) {
    return {
      status: 'SUSPICIOUS',
      score: 45,
      reason: 'Expected mileage is not configured for this project.',
      actualMileage,
      expectedMileage: null,
      variancePercent: null,
    }
  }

  const variancePercent = roundNumber(((derivedExpectedMileage - actualMileage) / derivedExpectedMileage) * 100)
  if (variancePercent >= 30) {
    return {
      status: 'FRAUD',
      score: Math.min(99, roundNumber(70 + variancePercent / 2, 0)),
      reason: `Fuel efficiency is ${variancePercent}% below the configured expectation.`,
      actualMileage,
      expectedMileage: roundNumber(derivedExpectedMileage),
      variancePercent,
    }
  }

  if (variancePercent >= 15) {
    return {
      status: 'SUSPICIOUS',
      score: roundNumber(40 + variancePercent),
      reason: `Fuel efficiency is ${variancePercent}% below the configured expectation.`,
      actualMileage,
      expectedMileage: roundNumber(derivedExpectedMileage),
      variancePercent,
    }
  }

  return {
    status: 'NORMAL',
    score: Math.max(0, roundNumber(variancePercent)),
    reason: null,
    actualMileage,
    expectedMileage: roundNumber(derivedExpectedMileage),
    variancePercent,
  }
}
