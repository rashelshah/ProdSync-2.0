import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/auth.store'
import { apiOrigin } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { transportService } from '@/services/transport.service'
import { mapTransportKpis, transformFuelLog, transformTripForUI } from '@/services/adapters/transport.adapter'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import type { TransportAlert, TripFilters } from '../types'

let transportSocket: Socket | null = null

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

  useEffect(() => {
    if (!activeProjectId) {
      return
    }

    let cancelled = false
    const handleRealtimeUpdate = (payload: { projectId: string }) => {
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

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session?.access_token) {
        return
      }

      if (!transportSocket) {
        transportSocket = io(apiOrigin(), {
          auth: {
            token: data.session.access_token,
          },
          transports: ['websocket'],
        })
      }

      transportSocket.emit('project:subscribe', activeProjectId)

      transportSocket.on('trip_started', handleRealtimeUpdate)
      transportSocket.on('trip_ended', handleRealtimeUpdate)
      transportSocket.on('fuel_logged', handleRealtimeUpdate)
      transportSocket.on('alert_created', handleRealtimeUpdate)
    })

    return () => {
      cancelled = true
      transportSocket?.off('trip_started', handleRealtimeUpdate)
      transportSocket?.off('trip_ended', handleRealtimeUpdate)
      transportSocket?.off('fuel_logged', handleRealtimeUpdate)
      transportSocket?.off('alert_created', handleRealtimeUpdate)
      transportSocket?.emit('project:unsubscribe', activeProjectId)
    }
  }, [activeProjectId, canViewAlerts, queryClient])

  const kpis = mapTransportKpis(trips, fuelLogs, vehicles)
  const tripsUI = trips.map(transformTripForUI)
  const fuelLogsUI = fuelLogs.map(transformFuelLog)

  return {
    activeProjectId,
    isLoading: isLoadingProjectContext || tripsQ.isLoading || fuelQ.isLoading || vehiclesQ.isLoading,
    isError: isErrorProjectContext || tripsQ.isError || vehiclesQ.isError || alertsQ.isError || driversQ.isError,
    fuelFailed: fuelQ.isError,
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
