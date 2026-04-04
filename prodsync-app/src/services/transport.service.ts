import type { Trip, FuelLog, Vehicle } from '@/types'

export const transportService = {
  async getTrips(): Promise<Trip[]> {
    return []
  },
  async getFuelLogs(): Promise<FuelLog[]> {
    return []
  },
  async getVehicles(): Promise<Vehicle[]> {
    return []
  },
}
