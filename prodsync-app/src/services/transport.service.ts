import { apiFetch, readApiJson } from '@/lib/api'
import type {
  CreateVehicleInput,
  EndTripInput,
  FuelLog,
  FuelLogInput,
  GpsLog,
  ReviewFuelInput,
  StartTripInput,
  TransportDriver,
  TransportAlert,
  Trip,
  TripFilters,
  UpdateVehicleInput,
  Vehicle,
} from '@/modules/transport/types'

interface PaginatedResponse<T> {
  data: T[]
}

function withProjectId(projectId: string) {
  return `projectId=${encodeURIComponent(projectId)}`
}

function withProjectFilters(projectId: string, filters?: TripFilters) {
  const params = new URLSearchParams()
  params.set('projectId', projectId)

  if (!filters) {
    return params.toString()
  }

  if (filters.vehicleId) params.set('vehicleId', filters.vehicleId)
  if (filters.driverId) params.set('driverId', filters.driverId)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.status) params.set('status', filters.status)

  return params.toString()
}

function normalizeFuelLog(log: FuelLog): FuelLog {
  return {
    ...log,
    expectedMileage: Number(log.expectedMileage ?? 0),
    actualMileage: Number(log.actualMileage ?? 0),
    liters: Number(log.liters ?? 0),
    cost: log.cost != null ? Number(log.cost) : null,
    fraudScore: Number(log.fraudScore ?? 0),
  }
}

export const transportService = {
  async getTrips(projectId: string, filters?: TripFilters): Promise<Trip[]> {
    const response = await apiFetch(`/trips?${withProjectFilters(projectId, filters)}`)
    const payload = await readApiJson<PaginatedResponse<Trip>>(response)
    return payload.data
  },

  async getFuelLogs(projectId: string, filters?: TripFilters): Promise<FuelLog[]> {
    const response = await apiFetch(`/fuel?${withProjectFilters(projectId, filters)}`)
    const payload = await readApiJson<PaginatedResponse<FuelLog>>(response)
    return payload.data.map(normalizeFuelLog)
  },

  async getVehicles(projectId: string): Promise<Vehicle[]> {
    const response = await apiFetch(`/vehicles?${withProjectId(projectId)}`)
    const payload = await readApiJson<PaginatedResponse<Vehicle>>(response)
    return payload.data
  },

  async getAlerts(projectId: string): Promise<TransportAlert[]> {
    const response = await apiFetch(`/transport-alerts?${withProjectId(projectId)}`)
    const payload = await readApiJson<PaginatedResponse<TransportAlert>>(response)
    return payload.data
  },

  async getAssignableDrivers(projectId: string): Promise<TransportDriver[]> {
    const response = await apiFetch(`/vehicles/assignable-drivers?${withProjectId(projectId)}`)
    const payload = await readApiJson<{ drivers: TransportDriver[] }>(response)
    return payload.drivers ?? []
  },

  async getGpsLogs(projectId: string, input?: { tripId?: string; vehicleId?: string }): Promise<GpsLog[]> {
    const params = new URLSearchParams()
    params.set('projectId', projectId)
    if (input?.tripId) params.set('tripId', input.tripId)
    if (input?.vehicleId) params.set('vehicleId', input.vehicleId)

    const response = await apiFetch(`/gps-logs?${params.toString()}`)
    const payload = await readApiJson<PaginatedResponse<GpsLog>>(response)
    return payload.data
  },

  async createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
    const response = await apiFetch('/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ vehicle: Vehicle }>(response)
    return payload.vehicle
  },

  async updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const response = await apiFetch(`/vehicles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ vehicle: Vehicle }>(response)
    return payload.vehicle
  },

  async startTrip(input: StartTripInput): Promise<Trip> {
    const response = await apiFetch('/trips/start', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ trip: Trip }>(response)
    return payload.trip
  },

  async endTrip(input: EndTripInput): Promise<Trip> {
    const response = await apiFetch('/trips/end', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ trip: Trip }>(response)
    return payload.trip
  },

  async logFuel(input: FuelLogInput): Promise<FuelLog> {
    const formData = new FormData()
    formData.append('projectId', input.projectId)
    formData.append('vehicleId', input.vehicleId)
    formData.append('liters', String(input.liters))
    formData.append('receiptImage', input.receiptImage)
    formData.append('odometerImage', input.odometerImage)

    if (input.tripId) formData.append('tripId', input.tripId)
    if (input.cost !== undefined) formData.append('cost', String(input.cost))
    if (input.odometerKm !== undefined) formData.append('odometerKm', String(input.odometerKm))
    if (input.fuelType) formData.append('fuelType', input.fuelType)
    if (input.expectedMileage !== undefined) formData.append('expectedMileage', String(input.expectedMileage))
    if (input.notes) formData.append('notes', input.notes)

    const response = await apiFetch('/fuel', {
      method: 'POST',
      body: formData,
    })
    const payload = await readApiJson<{ fuelLog: FuelLog }>(response)
    return normalizeFuelLog(payload.fuelLog)
  },

  async reviewFuel(id: string, input: ReviewFuelInput): Promise<FuelLog> {
    const response = await apiFetch(`/fuel/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const payload = await readApiJson<{ fuelLog: FuelLog }>(response)
    return normalizeFuelLog(payload.fuelLog)
  },
}
