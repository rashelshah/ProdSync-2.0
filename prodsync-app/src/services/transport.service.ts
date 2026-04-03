import type { Trip, FuelLog, Vehicle } from '@/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const MOCK_TRIPS: Trip[] = [
  { id: 't1', vehicleId: 'v1', vehicleName: 'Vanity Van 2', driverName: 'John S.', startTime: '08:00', endTime: '14:20', distanceKm: 142, status: 'completed' },
  { id: 't2', vehicleId: 'v2', vehicleName: 'Gen Truck 1', driverName: 'Marcus L.', startTime: '09:15', endTime: null, distanceKm: 58, status: 'active' },
  { id: 't3', vehicleId: 'v3', vehicleName: 'Art Van 4', driverName: 'Sarah K.', startTime: '11:30', endTime: '13:00', distanceKm: 22, status: 'flagged' },
  { id: 't4', vehicleId: 'v4', vehicleName: 'Camera Truck 1', driverName: 'Robert M.', startTime: '06:00', endTime: null, distanceKm: 88, status: 'active' },
  { id: 't5', vehicleId: 'v5', vehicleName: 'Wardrobe Van', driverName: 'Linda V.', startTime: '07:00', endTime: '12:00', distanceKm: 34, status: 'completed' },
]

const MOCK_FUEL_LOGS: FuelLog[] = [
  { id: 'f1', date: '2024-10-24', vehicleId: 'v1', vehicleName: 'GT-01', litres: 120, expectedMileage: 4.2, actualMileage: 4.1, auditStatus: 'verified' },
  { id: 'f2', date: '2024-10-24', vehicleId: 'v2', vehicleName: 'VV-02', litres: 85, expectedMileage: 12.0, actualMileage: 8.5, auditStatus: 'mismatch' },
  { id: 'f3', date: '2024-10-24', vehicleId: 'v3', vehicleName: 'AT-04', litres: 60, expectedMileage: 10.0, actualMileage: 9.8, auditStatus: 'verified' },
  { id: 'f4', date: '2024-10-24', vehicleId: 'v4', vehicleName: 'CT-01', litres: 200, expectedMileage: 3.5, actualMileage: 2.1, auditStatus: 'mismatch' },
]

const MOCK_VEHICLES: Vehicle[] = [
  { id: 'v1', name: 'Vanity Van 2', type: 'Van', status: 'active', driverId: 'd1' },
  { id: 'v2', name: 'Gen Truck 1', type: 'Truck', status: 'active', driverId: 'd2' },
  { id: 'v3', name: 'Art Van 4', type: 'Van', status: 'exception', driverId: 'd3' },
  { id: 'v4', name: 'Camera Truck 1', type: 'Truck', status: 'active', driverId: 'd4' },
  { id: 'v5', name: 'Generator Truck 2', type: 'Truck', status: 'idle', driverId: 'd5' },
]

export const transportService = {
  async getTrips(): Promise<Trip[]> {
    await delay(300)
    return MOCK_TRIPS
  },
  async getFuelLogs(): Promise<FuelLog[]> {
    await delay(300)
    return MOCK_FUEL_LOGS
  },
  async getVehicles(): Promise<Vehicle[]> {
    await delay(200)
    return MOCK_VEHICLES
  },
}
