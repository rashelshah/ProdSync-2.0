import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, ErrorState, PageLoader } from '@/components/system/SystemStates'
import { invalidateProjectData } from '@/context/project-sync'
import { useAuthStore } from '@/features/auth/auth.store'
import { canAccessActorsWorkspace, canManageActorsOperations } from '@/features/auth/role-capabilities'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { resolveErrorMessage, showError, showSuccess } from '@/lib/toast'
import { useActorsData } from '@/modules/actors/hooks/useActorsData'
import type {
  ActorCallSheetAssignment,
  ActorCallSheetAssignmentType,
  ActorCallSheetType,
  ActorPaymentStatus,
  CreateActorCallSheetInput,
  CreateActorPaymentInput,
  CreateJuniorArtistLogInput,
} from '@/modules/actors/types'
import { actorsService } from '@/services/actors.service'
import { projectsService } from '@/services/projects.service'
import { formatCurrency, formatDate } from '@/utils'

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
    </div>
  )
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return (
    <Surface variant="muted" className="min-h-[120px]" padding="md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-white">{value}</p>
    </Surface>
  )
}

const fieldClassName = 'rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-orange-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white'

const callSheetPresets: Record<ActorCallSheetType, Array<{ label: string; timeIn: string; timeOut: string }>> = {
  standard: [
    { label: '9:00 AM - 6:00 PM', timeIn: '09:00', timeOut: '18:00' },
    { label: '2:00 PM - 10:00 PM', timeIn: '14:00', timeOut: '22:00' },
    { label: '6:00 PM - 2:00 AM', timeIn: '18:00', timeOut: '02:00' },
  ],
  one_and_half: [
    { label: '9:00 AM - 9:00 PM', timeIn: '09:00', timeOut: '21:00' },
    { label: '2:00 PM - 2:00 AM', timeIn: '14:00', timeOut: '02:00' },
  ],
  double: [
    { label: '9:00 AM - 2:00 AM', timeIn: '09:00', timeOut: '02:00' },
    { label: '2:00 PM - 6:00 AM', timeIn: '14:00', timeOut: '06:00' },
  ],
  custom: [],
}

function isDateWithinProject(date: string, startDate?: string, endDate?: string) {
  if (!date) return false
  if (startDate && date < startDate) return false
  if (endDate && date > endDate) return false
  return true
}

function hasValidTimeRange(timeIn: string, timeOut: string) {
  return Boolean(timeIn && timeOut && timeIn !== timeOut)
}

function describeAssignment(assignment: ActorCallSheetAssignment) {
  if (assignment.assignmentType === 'crew') {
    return [assignment.crewName, assignment.department, assignment.designation].filter(Boolean).join(' • ')
  }

  return [assignment.actorName, assignment.characterName].filter(Boolean).join(' • ')
}

function resolveActorsActionError(error: unknown, fallback: string) {
  const message = resolveErrorMessage(error, fallback)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('database setup is incomplete')
    || normalized.includes('database migration')
    || (
      typeof error === 'object'
      && error !== null
      && 'status' in error
      && (error as { status?: unknown }).status === 503
    )
  ) {
    return 'Actor & Juniors is not ready for saving yet. Apply the latest database migration, then try again.'
  }

  return message
}

function resolveActorsLoadError(error: unknown) {
  const message = resolveErrorMessage(error, 'Actor & Juniors data could not be loaded.')
  const normalized = message.toLowerCase()
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? (error as { status?: unknown }).status
    : null

  if (status === 404 || normalized.includes('route not found')) {
    return 'Actor & Juniors is not available on the deployed backend yet. Redeploy the backend service with the latest actors module, then refresh this page.'
  }

  return message
}

export function ActorsView() {
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { activeProjectId, activeProject, isLoadingProjectContext } = useResolvedProjectContext()
  const planningQ = useQuery({
    queryKey: ['project-planning', activeProjectId],
    queryFn: () => projectsService.getProjectPlanning(activeProjectId!),
    enabled: Boolean(activeProjectId),
    staleTime: 30_000,
  })
  const canManageActors = canManageActorsOperations(user)
  const [lookActorFilter, setLookActorFilter] = useState('')
  const [lookCharacterFilter, setLookCharacterFilter] = useState('')

  const [juniorForm, setJuniorForm] = useState<CreateJuniorArtistLogInput>({
    projectId: activeProjectId ?? '',
    shootDate: '',
    agentName: '',
    numberOfArtists: 0,
    ratePerArtist: 0,
  })
  const [callSheetForm, setCallSheetForm] = useState<CreateActorCallSheetInput>({
    projectId: activeProjectId ?? '',
    shootDate: '',
    locationId: '',
    location: '',
    callType: 'standard',
    timeIn: '09:00',
    timeOut: '18:00',
    callTime: '09:00',
    assignmentType: 'actor',
    assignments: [],
    notes: '',
  })
  const [callSheetPresetIndex, setCallSheetPresetIndex] = useState(0)
  const [callSheetAssignmentType, setCallSheetAssignmentType] = useState<ActorCallSheetAssignmentType>('actor')
  const [actorAssignmentDraft, setActorAssignmentDraft] = useState({ actorName: '', characterName: '' })
  const [crewAssignmentDraft, setCrewAssignmentDraft] = useState({ crewMemberId: '' })
  const [paymentForm, setPaymentForm] = useState<CreateActorPaymentInput>({
    projectId: activeProjectId ?? '',
    actorName: '',
    paymentType: 'batta',
    amount: 0,
    paymentDate: '',
    status: 'pending',
  })
  const [lookForm, setLookForm] = useState({
    actorName: '',
    characterName: '',
    notes: '',
    image: null as File | null,
  })

  const { juniorLogs, callSheetGroups, projectLocations, crewMembers, payments, looks, alerts, error, isLoading, isError, refetch } = useActorsData(
    activeProjectId,
    {
      actor: lookActorFilter.trim() || undefined,
      character: lookCharacterFilter.trim() || undefined,
    },
  )

  const totals = useMemo(() => {
    const juniorCost = juniorLogs.reduce((sum, item) => sum + item.totalCost, 0)
    const pendingBatta = payments.filter(item => item.paymentType === 'batta' && item.status === 'pending').length
    return {
      juniorCost,
      pendingBatta,
      lookCount: looks.length,
      callSheetDays: callSheetGroups.length,
    }
  }, [callSheetGroups.length, juniorLogs, looks.length, payments])

  async function refreshProject() {
    await invalidateProjectData(queryClient, {
      projectId: activeProjectId,
      userId: user?.id,
    })
  }

  const activeCallSheetPresets = callSheetPresets[callSheetForm.callType]
  const selectedCrewMember = crewMembers.find(member => member.id === crewAssignmentDraft.crewMemberId) ?? null

  function updateCallSheetType(callType: ActorCallSheetType) {
    const preset = callSheetPresets[callType][0]
    setCallSheetPresetIndex(0)
    setCallSheetForm(current => ({
      ...current,
      projectId: activeProjectId ?? current.projectId,
      callType,
      timeIn: preset?.timeIn ?? current.timeIn,
      timeOut: preset?.timeOut ?? current.timeOut,
      callTime: preset?.timeIn ?? current.timeIn,
    }))
  }

  function updateCallSheetPreset(index: number) {
    const preset = activeCallSheetPresets[index]
    if (!preset) return
    setCallSheetPresetIndex(index)
    setCallSheetForm(current => ({
      ...current,
      projectId: activeProjectId ?? current.projectId,
      timeIn: preset.timeIn,
      timeOut: preset.timeOut,
      callTime: preset.timeIn,
    }))
  }

  function addCallSheetAssignment() {
    if (callSheetAssignmentType === 'actor') {
      const actorName = actorAssignmentDraft.actorName.trim()
      if (!actorName) {
        showError('Missing actor assignment.')
        return
      }

      setCallSheetForm(current => ({
        ...current,
        projectId: activeProjectId ?? current.projectId,
        assignmentType: 'actor',
        assignments: [
          ...current.assignments,
          {
            assignmentType: 'actor',
            actorName,
            characterName: actorAssignmentDraft.characterName.trim() || null,
          },
        ],
      }))
      setActorAssignmentDraft({ actorName: '', characterName: '' })
      return
    }

    if (!selectedCrewMember) {
      showError('Missing crew assignment.')
      return
    }

    setCallSheetForm(current => ({
      ...current,
      projectId: activeProjectId ?? current.projectId,
      assignmentType: 'crew',
      assignments: [
        ...current.assignments,
        {
          assignmentType: 'crew',
          crewMemberId: selectedCrewMember.id,
          crewName: selectedCrewMember.name,
          department: selectedCrewMember.department,
          designation: selectedCrewMember.designation,
        },
      ],
    }))
    setCrewAssignmentDraft({ crewMemberId: '' })
  }

  function removeCallSheetAssignment(index: number) {
    setCallSheetForm(current => ({
      ...current,
      assignments: current.assignments.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  const createJuniorMutation = useMutation({
    mutationFn: actorsService.createJuniorLog,
    onSuccess: async () => {
      showSuccess('Junior artist log added.')
      setJuniorForm(current => ({ ...current, shootDate: '', agentName: '', numberOfArtists: 0, ratePerArtist: 0 }))
      await refreshProject()
    },
    onError: error => showError(resolveActorsActionError(error, 'Could not save junior artist log.')),
  })

  const deleteJuniorMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => actorsService.deleteJuniorLog(projectId, id),
    onSuccess: async () => {
      showSuccess('Junior artist log removed.')
      await refreshProject()
    },
    onError: error => showError(resolveActorsActionError(error, 'Could not remove junior artist log.')),
  })

  const createCallSheetMutation = useMutation({
    mutationFn: actorsService.createCallSheet,
    onSuccess: async () => {
      showSuccess('Call sheet created.')
      setCallSheetForm(current => ({
        ...current,
        shootDate: '',
        locationId: '',
        location: '',
        callType: 'standard',
        timeIn: '09:00',
        timeOut: '18:00',
        callTime: '09:00',
        assignmentType: 'actor',
        assignments: [],
        notes: '',
      }))
      setCallSheetPresetIndex(0)
      setCallSheetAssignmentType('actor')
      setActorAssignmentDraft({ actorName: '', characterName: '' })
      setCrewAssignmentDraft({ crewMemberId: '' })
      await refreshProject()
    },
    onError: error => showError(resolveActorsActionError(error, 'Could not create call sheet.')),
  })

  const createPaymentMutation = useMutation({
    mutationFn: actorsService.createPayment,
    onSuccess: async () => {
      showSuccess('Actor payment saved.')
      setPaymentForm(current => ({ ...current, actorName: '', amount: 0, paymentDate: '', paymentType: 'batta', status: 'pending' }))
      await refreshProject()
    },
    onError: error => showError(resolveActorsActionError(error, 'Could not save actor payment.')),
  })

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActorPaymentStatus }) => actorsService.updatePaymentStatus(id, {
      projectId: activeProjectId!,
      status,
    }),
    onSuccess: async () => {
      showSuccess('Payment status updated.')
      await refreshProject()
    },
    onError: error => showError(resolveActorsActionError(error, 'Could not update payment status.')),
  })

  const createLookMutation = useMutation({
    mutationFn: () => actorsService.createLook({
      projectId: activeProjectId!,
      actorName: lookForm.actorName,
      characterName: lookForm.characterName || undefined,
      notes: lookForm.notes || undefined,
      image: lookForm.image!,
    }),
    onSuccess: async () => {
      showSuccess('Look test uploaded.')
      setLookForm({ actorName: '', characterName: '', notes: '', image: null })
      await refreshProject()
    },
    onError: error => showError(resolveActorsActionError(error, 'Could not upload look test.')),
  })

  const deleteLookMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) => actorsService.deleteLook(projectId, id),
    onSuccess: async () => {
      showSuccess('Look test removed.')
      await refreshProject()
    },
    onError: error => showError(resolveActorsActionError(error, 'Could not remove look test.')),
  })

  if (!user) {
    return null
  }

  if (isLoadingProjectContext) {
    return <PageLoader open message="Loading actor workspace..." />
  }

  if (!activeProjectId) {
    return (
      <Surface variant="muted" className="mx-auto mt-8 max-w-3xl" padding="lg">
        <EmptyState icon="workspaces" title="Select a project first" description="Actor & Juniors data is scoped to the active project." />
      </Surface>
    )
  }

  if (!canAccessActorsWorkspace(user)) {
    return (
      <Surface variant="muted" className="mx-auto mt-8 max-w-3xl" padding="lg">
        <EmptyState icon="lock" title="Actor workspace access required" description="Your current role does not include Actor & Juniors access for this project." />
      </Surface>
    )
  }

  if (isLoading) {
    return <PageLoader open message="Loading actor records..." />
  }

  if (isError) {
    return <ErrorState message={resolveActorsLoadError(error)} retry={() => void refetch()} />
  }

  return (
    <div className="page-shell max-md:pt-16">
      {planningQ.data?.sections.find(section => section.sectionType === 'cast_planning')?.payload?.estimatedCast ? (
        <Surface variant="warning" padding="md">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Planning estimated {Number(planningQ.data.sections.find(section => section.sectionType === 'cast_planning')?.payload?.estimatedCast ?? 0)} cast and artist entries.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Use this as a reference while adding actual actors, junior artists, payments, and call sheets.</p>
        </Surface>
      ) : null}

      <header className="page-header">
        <div>
          <span className="page-kicker">Department Workspace</span>
          <h1 className="page-title mt-1">Actor & Juniors</h1>
          <p className="page-subtitle mt-2">
            Manage junior artist supply, actor call sheets, batta versus remuneration, and look continuity for {activeProject?.name ?? 'this project'}.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PanelStat label="Junior Spend" value={formatCurrency(totals.juniorCost, activeProject?.currency ?? 'INR')} />
        <PanelStat label="Pending Batta" value={String(totals.pendingBatta)} />
        <PanelStat label="Look Tests" value={String(totals.lookCount)} />
        <PanelStat label="Call Sheet Days" value={String(totals.callSheetDays)} />
      </section>

      <Surface variant="raised" className="mt-6" padding="lg">
        <SectionHeader title="Alerts" subtitle="Dynamic issues based on upcoming shoots, pending batta, and missing look continuity." />
        {alerts.length === 0 ? (
          <EmptyState icon="notifications" title="No actor alerts" description="Everything currently required for Actor & Juniors is in place." />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={`${alert.timestamp}-${index}`}
                className={`rounded-[22px] border px-4 py-4 ${
                  alert.type === 'critical'
                    ? 'border-red-200 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10'
                    : 'border-orange-200 bg-orange-50/70 dark:border-orange-500/20 dark:bg-orange-500/10'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{alert.message}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{alert.type}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(alert.timestamp)}</p>
              </div>
            ))}
          </div>
        )}
      </Surface>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Surface variant="raised" padding="lg">
          <SectionHeader title="Junior Artist Bulk Management" subtitle="Track daily junior artist supply and auto-calculate total cost per agent." />
          <div className="grid gap-3 md:grid-cols-2">
            <input type="date" value={juniorForm.shootDate} onChange={event => setJuniorForm(current => ({ ...current, projectId: activeProjectId, shootDate: event.target.value }))} className={fieldClassName} />
            <input type="text" value={juniorForm.agentName} onChange={event => setJuniorForm(current => ({ ...current, projectId: activeProjectId, agentName: event.target.value }))} placeholder="Agent name" className={fieldClassName} />
            <input
              type="number"
              min="1"
              value={juniorForm.numberOfArtists > 0 ? juniorForm.numberOfArtists : ''}
              onChange={event => setJuniorForm(current => ({
                ...current,
                projectId: activeProjectId,
                numberOfArtists: event.target.value ? Number(event.target.value) : 0,
              }))}
              placeholder="Number of junior artists"
              className={fieldClassName}
            />
            <input
              type="number"
              min="1"
              step="0.01"
              value={juniorForm.ratePerArtist > 0 ? juniorForm.ratePerArtist : ''}
              onChange={event => setJuniorForm(current => ({
                ...current,
                projectId: activeProjectId,
                ratePerArtist: event.target.value ? Number(event.target.value) : 0,
              }))}
              placeholder="Rate per artist (example: 900)"
              className={fieldClassName}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
            <p>Enter how many junior artists the agent supplied for that shoot day.</p>
            <p>Enter the payment amount for one artist for that day.</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Total cost: {formatCurrency((juniorForm.numberOfArtists || 0) * (juniorForm.ratePerArtist || 0), activeProject?.currency ?? 'INR')}
            </p>
            <button
              onClick={() => {
                if (!canManageActors) {
                  showError('You do not have permission to create junior artist logs.')
                  return
                }
                if (!juniorForm.shootDate || !juniorForm.agentName.trim()) {
                  showError('Shoot date and agent name are required.')
                  return
                }
                if (juniorForm.numberOfArtists <= 0) {
                  showError('Enter how many junior artists were supplied for the day.')
                  return
                }
                if (juniorForm.ratePerArtist <= 0) {
                  showError('Enter the daily rate for one junior artist.')
                  return
                }
                createJuniorMutation.mutate({ ...juniorForm, projectId: activeProjectId })
              }}
              disabled={createJuniorMutation.isPending || !canManageActors}
              className="btn-primary"
            >
              Add Entry
            </button>
          </div>
          <div className="mt-6 space-y-3">
            {juniorLogs.length === 0 ? (
              <EmptyState icon="groups" title="No junior artist logs yet" description="Daily agent supply entries will appear here once they are created." />
            ) : (
              juniorLogs.map(log => (
                <div key={log.id} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{log.agentName}</p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatDate(log.shootDate)} • {log.numberOfArtists} artists • {formatCurrency(log.ratePerArtist, activeProject?.currency ?? 'INR')} each
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatCurrency(log.totalCost, activeProject?.currency ?? 'INR')}</p>
                      <button onClick={() => deleteJuniorMutation.mutate({ projectId: activeProjectId, id: log.id })} disabled={deleteJuniorMutation.isPending || !canManageActors} className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-500 transition hover:text-red-600 dark:text-red-400 dark:hover:text-red-300">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>

        <Surface variant="raised" padding="lg">
          <SectionHeader title="Call Sheet Generation" subtitle="Create production-aware actor and crew call sheets grouped by shoot date." />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="date"
              value={callSheetForm.shootDate}
              min={activeProject?.startDate || undefined}
              max={activeProject?.endDate || undefined}
              onChange={event => setCallSheetForm(current => ({ ...current, projectId: activeProjectId, shootDate: event.target.value }))}
              className={fieldClassName}
            />
            <select
              value={callSheetForm.locationId}
              onChange={event => {
                const location = projectLocations.find(item => item.id === event.target.value)
                setCallSheetForm(current => ({
                  ...current,
                  projectId: activeProjectId,
                  locationId: location?.id ?? '',
                  location: location?.name ?? '',
                }))
              }}
              className={fieldClassName}
            >
              <option value="">Select project location</option>
              {projectLocations.map(location => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            <select value={callSheetForm.callType} onChange={event => updateCallSheetType(event.target.value as ActorCallSheetType)} className={fieldClassName}>
              <option value="standard">Standard</option>
              <option value="one_and_half">1.5 Call Sheet</option>
              <option value="double">Double Call Sheet</option>
              <option value="custom">Custom</option>
            </select>
            {callSheetForm.callType === 'custom' ? (
              <>
                <input type="time" value={callSheetForm.timeIn} onChange={event => setCallSheetForm(current => ({ ...current, projectId: activeProjectId, timeIn: event.target.value, callTime: event.target.value }))} className={fieldClassName} />
                <input type="time" value={callSheetForm.timeOut} onChange={event => setCallSheetForm(current => ({ ...current, projectId: activeProjectId, timeOut: event.target.value }))} className={fieldClassName} />
              </>
            ) : (
              <select value={callSheetPresetIndex} onChange={event => updateCallSheetPreset(Number(event.target.value))} className={fieldClassName}>
                {activeCallSheetPresets.map((preset, index) => (
                  <option key={preset.label} value={index}>{preset.label}</option>
                ))}
              </select>
            )}
            <select value={callSheetAssignmentType} onChange={event => setCallSheetAssignmentType(event.target.value as ActorCallSheetAssignmentType)} className={fieldClassName}>
              <option value="actor">Actor</option>
              <option value="crew">Crew</option>
            </select>
            {callSheetAssignmentType === 'actor' ? (
              <>
                <input type="text" value={actorAssignmentDraft.actorName} onChange={event => setActorAssignmentDraft(current => ({ ...current, actorName: event.target.value }))} placeholder="Actor name" className={fieldClassName} />
                <input type="text" value={actorAssignmentDraft.characterName} onChange={event => setActorAssignmentDraft(current => ({ ...current, characterName: event.target.value }))} placeholder="Character name" className={fieldClassName} />
              </>
            ) : (
              <>
                <select value={crewAssignmentDraft.crewMemberId} onChange={event => setCrewAssignmentDraft({ crewMemberId: event.target.value })} className={fieldClassName}>
                  <option value="">Select crew member</option>
                  {crewMembers.map(member => (
                    <option key={member.id} value={member.id}>{member.name} - {member.department} - {member.designation}</option>
                  ))}
                </select>
                <input type="text" value={selectedCrewMember ? `${selectedCrewMember.department} - ${selectedCrewMember.designation}` : ''} readOnly placeholder="Department - designation" className={fieldClassName} />
              </>
            )}
            <input type="text" value={callSheetForm.notes ?? ''} onChange={event => setCallSheetForm(current => ({ ...current, projectId: activeProjectId, notes: event.target.value }))} placeholder="Notes" className={fieldClassName} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {callSheetForm.assignments.length === 0 ? (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">No assignees added.</span>
              ) : (
                callSheetForm.assignments.map((assignment, index) => (
                  <button
                    key={`${assignment.assignmentType}-${index}-${describeAssignment(assignment)}`}
                    type="button"
                    onClick={() => removeCallSheetAssignment(index)}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-red-300 hover:text-red-500 dark:border-zinc-800 dark:text-zinc-300"
                  >
                    {describeAssignment(assignment)} x
                  </button>
                ))
              )}
            </div>
            <button type="button" onClick={addCallSheetAssignment} disabled={!canManageActors} className="btn-soft">
              Add Assignee
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                if (!canManageActors) {
                  showError('You do not have permission to create call sheets.')
                  return
                }
                if (!callSheetForm.shootDate) {
                  showError('Call sheet date must be within project timeline.')
                  return
                }
                if (!isDateWithinProject(callSheetForm.shootDate, activeProject?.startDate, activeProject?.endDate)) {
                  showError('Call sheet date must be within project timeline.')
                  return
                }
                if (!callSheetForm.locationId) {
                  showError('Missing location.')
                  return
                }
                if (!hasValidTimeRange(callSheetForm.timeIn, callSheetForm.timeOut)) {
                  showError('Invalid time range.')
                  return
                }
                if (callSheetForm.assignments.length === 0) {
                  showError('Missing assignee.')
                  return
                }
                createCallSheetMutation.mutate({
                  ...callSheetForm,
                  projectId: activeProjectId,
                  callTime: callSheetForm.timeIn,
                })
              }}
              disabled={createCallSheetMutation.isPending || projectLocations.length === 0 || !canManageActors}
              className="btn-primary"
            >
              Create Call Sheet
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {callSheetGroups.length === 0 ? (
              <EmptyState icon="event_note" title="No call sheets yet" description="Daily actor call sheets will appear here once they are created." />
            ) : (
              callSheetGroups.map(group => (
                <div key={group.shootDate} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatDate(group.shootDate)}</p>
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{group.entries.reduce((sum, entry) => sum + Math.max(entry.assignments?.length ?? 0, 1), 0)} assignees</span>
                  </div>
                  <div className="space-y-3">
                    {group.entries.map(entry => (
                      <div key={entry.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {(entry.assignments?.length ? entry.assignments.map(describeAssignment).join(', ') : entry.actorName) || 'Unassigned'}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{entry.location} • {entry.timeIn ?? entry.callTime} - {entry.timeOut ?? entry.callTime}</p>
                        {entry.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{entry.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Surface variant="raised" padding="lg">
          <SectionHeader title="Batta & Payment Tracking" subtitle="Track batta separately from remuneration and update payout status inline." />
          <div className="grid gap-3 md:grid-cols-2">
            <input type="text" value={paymentForm.actorName} onChange={event => setPaymentForm(current => ({ ...current, projectId: activeProjectId, actorName: event.target.value }))} placeholder="Actor name" className={fieldClassName} />
            <select value={paymentForm.paymentType} onChange={event => setPaymentForm(current => ({ ...current, projectId: activeProjectId, paymentType: event.target.value as CreateActorPaymentInput['paymentType'] }))} className={fieldClassName}>
              <option value="batta">Batta (daily allowance)</option>
              <option value="remuneration">Remuneration (contract payment)</option>
            </select>
            <input
              type="number"
              min="1"
              step="0.01"
              value={paymentForm.amount > 0 ? paymentForm.amount : ''}
              onChange={event => setPaymentForm(current => ({
                ...current,
                projectId: activeProjectId,
                amount: event.target.value ? Number(event.target.value) : 0,
              }))}
              placeholder="Payment amount (example: 5000)"
              className={fieldClassName}
            />
            <input
              type="date"
              value={paymentForm.paymentDate}
              onChange={event => setPaymentForm(current => ({ ...current, projectId: activeProjectId, paymentDate: event.target.value }))}
              className={fieldClassName}
              title="Choose the payment date"
              aria-label="Payment date"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
            <p>Enter the total batta or remuneration amount to be paid.</p>
            <p>Select the date when this payment is due or was paid.</p>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                if (!canManageActors) {
                  showError('You do not have permission to create actor payments.')
                  return
                }
                if (!paymentForm.actorName.trim() || !paymentForm.paymentDate) {
                  showError('Actor name and payment date are required.')
                  return
                }
                if (paymentForm.amount <= 0) {
                  showError('Enter the payment amount before saving.')
                  return
                }
                createPaymentMutation.mutate({ ...paymentForm, projectId: activeProjectId })
              }}
              disabled={createPaymentMutation.isPending || !canManageActors}
              className="btn-primary"
            >
              Add Payment
            </button>
          </div>
          <div className="mt-6 overflow-x-auto">
            {payments.length === 0 ? (
              <EmptyState icon="payments" title="No actor payments yet" description="Batta and remuneration entries will appear here once they are created." />
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-zinc-500 dark:text-zinc-400">
                    <th className="pb-3 font-medium">Actor</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-3 text-zinc-900 dark:text-white">{payment.actorName}</td>
                      <td className="py-3 capitalize text-zinc-500 dark:text-zinc-400">{payment.paymentType}</td>
                      <td className="py-3 text-zinc-900 dark:text-white">{formatCurrency(payment.amount, activeProject?.currency ?? 'INR')}</td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">{formatDate(payment.paymentDate)}</td>
                      <td className="py-3">
                        <button
                          onClick={() => updatePaymentMutation.mutate({ id: payment.id, status: payment.status === 'paid' ? 'pending' : 'paid' })}
                          disabled={updatePaymentMutation.isPending || !canManageActors}
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            payment.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-500/12 dark:text-orange-300'
                          }`}
                        >
                          {payment.status}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Surface>

        <Surface variant="raised" padding="lg">
          <SectionHeader title="Costume / Look Test Tracking" subtitle="Upload look references for continuity and filter them by actor or character." />
          <div className="grid gap-3 md:grid-cols-2">
            <input type="text" value={lookForm.actorName} onChange={event => setLookForm(current => ({ ...current, actorName: event.target.value }))} placeholder="Actor name" className={fieldClassName} />
            <input type="text" value={lookForm.characterName} onChange={event => setLookForm(current => ({ ...current, characterName: event.target.value }))} placeholder="Character name" className={fieldClassName} />
            <input type="text" value={lookForm.notes} onChange={event => setLookForm(current => ({ ...current, notes: event.target.value }))} placeholder="Notes" className={fieldClassName} />
            <input type="file" accept="image/*" onChange={event => setLookForm(current => ({ ...current, image: event.target.files?.[0] ?? null }))} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-orange-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:file:bg-orange-500/10 dark:file:text-orange-300" />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                if (!canManageActors) {
                  showError('You do not have permission to upload look tests.')
                  return
                }
                if (!lookForm.actorName.trim() || !lookForm.image) {
                  showError('Actor name and image are required.')
                  return
                }
                createLookMutation.mutate()
              }}
              disabled={createLookMutation.isPending || !canManageActors}
              className="btn-primary"
            >
              Upload Look Test
            </button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <input type="text" value={lookActorFilter} onChange={event => setLookActorFilter(event.target.value)} placeholder="Filter by actor" className={fieldClassName} />
            <input type="text" value={lookCharacterFilter} onChange={event => setLookCharacterFilter(event.target.value)} placeholder="Filter by character" className={fieldClassName} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {looks.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState icon="image" title="No look tests found" description="Uploaded actor look references will appear here. Use the filters above to narrow continuity searches." />
              </div>
            ) : (
              looks.map(look => (
                <div key={look.id} className="overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                  {look.imageUrl ? (
                    <img src={look.imageUrl} alt={look.actorName} className="h-56 w-full object-cover" />
                  ) : (
                    <div className="flex h-56 items-center justify-center bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">No image</div>
                  )}
                  <div className="px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{look.actorName}</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{look.characterName || 'Character not set'} • {formatDate(look.createdAt)}</p>
                        {look.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{look.notes}</p>}
                      </div>
                      <button onClick={() => deleteLookMutation.mutate({ projectId: activeProjectId, id: look.id })} disabled={deleteLookMutation.isPending || !canManageActors} className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500 transition hover:text-red-600 dark:text-red-400 dark:hover:text-red-300">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>
      </div>
    </div>
  )
}
