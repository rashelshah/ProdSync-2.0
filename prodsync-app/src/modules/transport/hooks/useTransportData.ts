import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/auth.store'
import { transportService } from '@/services/transport.service'
import { mapTransportKpis, transformFuelLog, transformTripForUI } from '@/services/adapters/transport.adapter'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { getTransportSocket } from '../realtime'
import type { TransportAlert, TripFilters } from '../types'

export function useTransportData(filters: TripFilters = {}) {
  const queryClient = useQueryClient()
  const { activeProjectId, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()
  const user = useAuthStore(state => state.user)
  const canViewAlerts = user?.role === 'EP' || user?.role === 'LineProducer' || user?.projectRoleTitle === 'Transport Captain'
  const canManageTransport = user?.role === 'EP' || user?.role === 'LineProducer' || user?.projectRoleTitle === 'Transport Captain'
  const sanitizedFilters = {
    vehicleId: filters.vehicleId || undefined,
    driverId: filters.driverId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    status: filters.status || undefined,
  }

  const tripsQ = useQuery({
    queryKey: ['trips', activeProjectId, sanitizedFilters],
    queryFn: () => transportService.getTrips(activeProjectId!, sanitizedFilters),
    staleTime: 15_000,
    enabled: Boolean(activeProjectId),
  })
  const fuelQ = useQuery({
    queryKey: ['fuel-logs', activeProjectId, sanitizedFilters],
    queryFn: () => transportService.getFuelLogs(activeProjectId!, sanitizedFilters),
    staleTime: 30_000,
    enabled: Boolean(activeProjectId),
  })
  const vehiclesQ = useQuery({
    queryKey: ['vehicles', activeProjectId],
    queryFn: () => transportService.getVehicles(activeProjectId!),
    staleTime: 60_000,
    enabled: Boolean(activeProjectId),
  })
  const alertsQ = useQuery({
    queryKey: ['transport-alerts', activeProjectId],
    queryFn: () => transportService.getAlerts(activeProjectId!),
    staleTime: 15_000,
    enabled: Boolean(activeProjectId && canViewAlerts),
  })
  const driversQ = useQuery({
    queryKey: ['transport-drivers', activeProjectId],
    queryFn: () => transportService.getAssignableDrivers(activeProjectId!),
    staleTime: 60_000,
    enabled: Boolean(activeProjectId && canManageTransport),
  })

  const trips = tripsQ.data ?? []
  const fuelLogs = fuelQ.data ?? []
  const vehicles = vehiclesQ.data ?? []
  const alerts = alertsQ.data ?? []
  const drivers = driversQ.data ?? []
  const isCoreLoading = isLoadingProjectContext || tripsQ.isLoading || vehiclesQ.isLoading
  const isCoreError = isErrorProjectContext || tripsQ.isError || vehiclesQ.isError
  const isAlertsLoading = canViewAlerts ? alertsQ.isLoading : false
  const isDriversLoading = canManageTransport ? driversQ.isLoading : false

  useEffect(() => {
    if (!activeProjectId) {
      return
    }

    let cancelled = false
    const handleTransportUpdate = (payload: { projectId: string }) => {
      if (payload.projectId !== activeProjectId) {
        return
      }

      void queryClient.invalidateQueries({ queryKey: ['trips', activeProjectId] })
      void queryClient.invalidateQueries({ queryKey: ['fuel-logs', activeProjectId] })
      void queryClient.invalidateQueries({ queryKey: ['vehicles', activeProjectId] })
      void queryClient.invalidateQueries({ queryKey: ['gps-logs', activeProjectId] })
      if (canViewAlerts) {
        void queryClient.invalidateQueries({ queryKey: ['transport-alerts', activeProjectId] })
      }
    }

    void getTransportSocket().then(socket => {
      if (cancelled || !socket) {
        return
      }

      socket.emit('project:subscribe', activeProjectId)

      socket.on('trip_started', handleTransportUpdate)
      socket.on('trip_ended', handleTransportUpdate)
      socket.on('fuel_logged', handleTransportUpdate)
      socket.on('alert_created', handleTransportUpdate)
    })

    return () => {
      cancelled = true
      void getTransportSocket().then(socket => {
        socket?.off('trip_started', handleTransportUpdate)
        socket?.off('trip_ended', handleTransportUpdate)
        socket?.off('fuel_logged', handleTransportUpdate)
        socket?.off('alert_created', handleTransportUpdate)
        socket?.emit('project:unsubscribe', activeProjectId)
      })
    }
  }, [activeProjectId, canViewAlerts, queryClient])

  const kpis = mapTransportKpis(trips, fuelLogs, vehicles)
  const tripsUI = trips.map(transformTripForUI)
  const fuelLogsUI = fuelLogs.map(transformFuelLog)

  return {
    activeProjectId,
    isLoading: isCoreLoading,
    isError: isCoreError,
    isTripsLoading: tripsQ.isLoading,
    isFuelLoading: fuelQ.isLoading,
    isVehiclesLoading: vehiclesQ.isLoading,
    isAlertsLoading,
    isDriversLoading,
    fuelFailed: fuelQ.isError,
    alertsFailed: alertsQ.isError,
    driversFailed: driversQ.isError,
    kpis,
    trips: tripsUI,
    fuelLogs: fuelLogsUI,
    vehicles,
    drivers,
    alerts: alerts as TransportAlert[],
    canViewAlerts,
    canManageTransport,
    rawAlerts: fuelLogsUI.filter(f => f.efficiencyRating !== 'good'),
  }
}
