import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CrewDashboardData } from '@/types'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { crewService } from '@/services/crew.service'
import { readCachedProjectLocation, seedDashboardWithCachedLocation, writeCachedProjectLocation } from '../location-cache'
import { useAuthStore } from '@/features/auth/auth.store'

const emptyDashboardData: CrewDashboardData = {
  summary: {
    totalCrew: 0,
    activeOTCrew: 0,
    totalOTCost: 0,
    battaRequested: 0,
    battaPaid: 0,
  },
  permissions: {
    canAccessModule: false,
    canCheckIn: false,
    canCheckOut: false,
    canRequestBatta: false,
    canViewOwnRecords: false,
    canViewAllCrew: false,
    canViewCrewTable: false,
    canApproveBatta: false,
    canMarkBattaPaid: false,
    canManageLocation: false,
    canViewFinancials: false,
    crewScope: 'none',
    summaryOnly: false,
  },
  projectLocation: null,
  myShift: {
    attendanceId: null,
    state: 'not_checked_in',
    checkInTime: null,
    checkOutTime: null,
    workingSeconds: 0,
    otMinutes: 0,
    otActive: false,
    geoVerified: false,
    shiftStatus: 'Not Started',
    checkInLocation: null,
    checkOutLocation: null,
  },
  myRecords: [],
  crew: [],
  otGroups: [],
  payouts: [],
  battaQueue: [],
  serverNow: new Date().toISOString(),
}

export function useCrewData() {
  const user = useAuthStore(state => state.user)
  const { activeProjectId, isLoadingProjectContext, isErrorProjectContext } = useResolvedProjectContext()
  const cachedProjectLocation = activeProjectId ? readCachedProjectLocation(activeProjectId) : null

  const dashboardQ = useQuery({
    queryKey: ['crew-dashboard', activeProjectId, user?.id],
    queryFn: () => crewService.getDashboard(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 10_000,
    refetchOnMount: 'always',
    initialData: activeProjectId ? seedDashboardWithCachedLocation(activeProjectId, emptyDashboardData) : undefined,
    refetchInterval: query => {
      const data = query.state.data as CrewDashboardData | undefined
      return data?.myShift?.state === 'checked_in' ? 30_000 : false
    },
  })

  const projectLocationQ = useQuery({
    queryKey: ['crew-location', activeProjectId],
    queryFn: () => crewService.getProjectLocation(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 10_000,
    refetchOnMount: 'always',
    initialData: cachedProjectLocation ?? undefined,
  })

  const data = dashboardQ.data ?? emptyDashboardData
  const projectLocation = projectLocationQ.data ?? data.projectLocation

  useEffect(() => {
    if (!activeProjectId) {
      return
    }

    writeCachedProjectLocation(activeProjectId, projectLocation)
  }, [activeProjectId, projectLocation])

  return {
    activeProjectId,
    isLoading: isLoadingProjectContext || dashboardQ.isLoading,
    isError: isErrorProjectContext || dashboardQ.isError,
    data,
    summary: data.summary,
    permissions: data.permissions,
    projectLocation,
    hasProjectLocationLoaded: !activeProjectId || projectLocationQ.isFetched,
    myShift: data.myShift,
    myRecords: data.myRecords,
    crew: data.crew,
    otGroups: data.otGroups,
    payouts: data.payouts,
    battaQueue: data.battaQueue,
    serverNow: data.serverNow,
    refetch: dashboardQ.refetch,
  }
}
