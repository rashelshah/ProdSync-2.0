import { useQuery } from '@tanstack/react-query'
import { transportService } from '@/services/transport.service'
import { mapTransportKpis, transformFuelLog, transformTripForUI } from '@/services/adapters/transport.adapter'
import { useAlertDispatcher } from '@/features/alerts/alert.dispatcher'

export function useTransportData() {
  const tripsQ = useQuery({ queryKey: ['trips'], queryFn: transportService.getTrips, staleTime: 15_000, refetchInterval: 30_000 })
  const fuelQ = useQuery({ queryKey: ['fuel-logs'], queryFn: transportService.getFuelLogs, staleTime: 30_000 })
  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: transportService.getVehicles, staleTime: 60_000 })

  const trips = tripsQ.data ?? []
  const fuelLogs = fuelQ.data ?? []
  const vehicles = vehiclesQ.data ?? []

  useAlertDispatcher({ fuelLogs })

  const kpis = mapTransportKpis(trips, fuelLogs)
  const tripsUI = trips.map(transformTripForUI)
  const fuelLogsUI = fuelLogs.map(transformFuelLog)

  return {
    isLoading: tripsQ.isLoading || fuelQ.isLoading,
    isError: tripsQ.isError,
    kpis,
    trips: tripsUI,
    fuelLogs: fuelLogsUI,
    vehicles,
    rawAlerts: fuelLogsUI.filter(f => f.efficiencyRating !== 'good'),
  }
}
