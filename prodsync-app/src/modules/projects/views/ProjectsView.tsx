import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, Clock3, MapPin, Plus, ShieldCheck, Users } from 'lucide-react'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState } from '@/components/system/SystemStates'
import { getDefaultWorkspacePath, isProducerRole } from '@/features/auth/access-rules'
import { getProjectRoleTitle, getRoleOptionsForDepartment } from '@/features/auth/onboarding'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { useProjectsStore } from '@/features/projects/projects.store'
import { projectsService } from '@/services/projects.service'
import { cn, formatCurrency, formatDate, timeAgo } from '@/utils'
import type { ProjectDepartment, ProjectJoinRequest, ProjectRecord, ProjectRequestedRole, ProjectStage } from '@/types'

const PROJECT_STATUSES: ProjectStage[] = ['pre-production', 'shooting', 'post']
const DEPARTMENTS: { id: ProjectDepartment; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'art', label: 'Art' },
  { id: 'transport', label: 'Transport' },
  { id: 'production', label: 'Production' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'post', label: 'Post' },
]

const statusTone: Record<ProjectStage, string> = {
  'pre-production': 'bg-zinc-100 text-zinc-700 dark:bg-white/8 dark:text-zinc-300',
  shooting: 'bg-orange-100 text-orange-700 dark:bg-orange-500/12 dark:text-orange-400',
  post: 'bg-sky-100 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300',
}

export function ProjectsView() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const setActiveProject = useProjectsStore(state => state.setActiveProject)
  const { projects, projectMembers, activeProjectId, isLoadingProjectContext } = useResolvedProjectContext()
  const discoverableProjectsQ = useQuery({
    queryKey: ['discoverable-projects'],
    queryFn: projectsService.getDiscoverableProjects,
    enabled: Boolean(user),
    staleTime: 60_000,
  })
  const joinRequestsQ = useQuery({
    queryKey: ['project-join-requests'],
    queryFn: projectsService.getJoinRequests,
    enabled: Boolean(user),
    staleTime: 15_000,
  })
  const joinRequests = joinRequestsQ.data ?? []

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [requestedRole, setRequestedRole] = useState<ProjectRequestedRole>('Crew Member')
  const [requestMessage, setRequestMessage] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectLocation, setProjectLocation] = useState('')
  const [projectStatus, setProjectStatus] = useState<ProjectStage>('pre-production')
  const [projectBudget, setProjectBudget] = useState('')
  const [projectCrew, setProjectCrew] = useState('')
  const [projectStartDate, setProjectStartDate] = useState('')
  const [projectEndDate, setProjectEndDate] = useState('')
  const [projectOtRules, setProjectOtRules] = useState('')
  const [selectedDepartments, setSelectedDepartments] = useState<ProjectDepartment[]>([])

  const currentUser = user ?? {
    id: '',
    name: '',
    role: 'Crew' as const,
    roleLabel: 'Crew Member',
    projectRoleTitle: 'Crew Member' as ProjectRequestedRole,
    departmentId: 'production' as ProjectDepartment,
  }

  const producerView = isProducerRole(currentUser.role)
  const visibleProjects = producerView ? projects : discoverableProjectsQ.data ?? projects
  const ownedProjects = projects.filter(project => project.ownerId === currentUser.id)
  const membershipProjectIds = new Set(projectMembers.filter(member => member.userId === currentUser.id).map(member => member.projectId))
  const accessibleProjectIds = Array.from(new Set([...ownedProjects.map(project => project.id), ...Array.from(membershipProjectIds)]))
  const joinRoleOptions = getRoleOptionsForDepartment(currentUser.departmentId ?? 'production').map(option => option.id)
  const relevantJoinRequests = producerView
    ? joinRequests.filter(request => request.status === 'pending')
    : joinRequests.filter(request => request.userId === currentUser.id)

  const selectedProject = selectedProjectId ? visibleProjects.find(project => project.id === selectedProjectId) ?? null : null
  const joinableProject = visibleProjects.find(project => !membershipProjectIds.has(project.id))

  const createProjectMutation = useMutation({
    mutationFn: projectsService.createProject,
    onSuccess: async (project) => {
      if (project) {
        setActiveProject(project.id)
      }

      setShowCreateModal(false)
      setProjectName('')
      setProjectLocation('')
      setProjectBudget('')
      setProjectCrew('')
      setProjectStartDate('')
      setProjectEndDate('')
      setProjectOtRules('')
      setSelectedDepartments([])

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accessible-projects', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['discoverable-projects'] }),
      ])
    },
  })

  const requestJoinMutation = useMutation({
    mutationFn: projectsService.createJoinRequest,
    onSuccess: async () => {
      setSelectedProjectId(null)
      setRequestMessage('')
      await queryClient.invalidateQueries({ queryKey: ['project-join-requests'] })
    },
  })

  const reviewJoinRequestMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'approved' | 'rejected' }) =>
      projectsService.reviewJoinRequest(requestId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-join-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['accessible-projects', user?.id] }),
      ])
    },
  })

  useEffect(() => {
    if (!user) return
    setRequestedRole(getProjectRoleTitle(currentUser))
  }, [currentUser, user])

  useEffect(() => {
    if (!user) return
    if (!joinRoleOptions.includes(requestedRole)) {
      setRequestedRole(joinRoleOptions[0])
    }
  }, [joinRoleOptions, requestedRole, user])

  useEffect(() => {
    if (!user) return
    if (activeProjectId && accessibleProjectIds.includes(activeProjectId)) return
    setActiveProject(accessibleProjectIds[0] ?? null)
  }, [accessibleProjectIds, activeProjectId, setActiveProject, user])

  if (!user) return null

  function openProject(projectId: string) {
    setActiveProject(projectId)
    navigate(getDefaultWorkspacePath(currentUser))
  }

  function createProjectSubmit() {
    createProjectMutation.mutate({
      name: projectName.trim(),
      location: projectLocation.trim(),
      status: projectStatus,
      budgetUSD: Number(projectBudget) || 0,
      activeCrew: Number(projectCrew) || 0,
      startDate: projectStartDate,
      endDate: projectEndDate,
      enabledDepartments: selectedDepartments,
      otRulesLabel: projectOtRules.trim(),
    })
  }

  function submitJoinRequest() {
    if (!selectedProject) return

    requestJoinMutation.mutate({
      projectId: selectedProject.id,
      roleRequested: requestedRole,
      message: requestMessage.trim() || undefined,
    })
  }

  function getRequestForProject(projectId: string) {
    return joinRequests.find(request => request.projectId === projectId && request.userId === currentUser.id)
  }

  function toggleDepartment(department: ProjectDepartment) {
    setSelectedDepartments(current =>
      current.includes(department) ? current.filter(item => item !== department) : [...current, department],
    )
  }

  if (isLoadingProjectContext) {
    return <LoadingState message="Loading project access..." />
  }

  return (
    <div className="page-shell page-shell-narrow max-md:pt-16">
      <header className="page-header max-md:py-4 max-md:px-2">
        <div>
          <span className="page-kicker max-md:text-[10px]">Access Control</span>
          <h1 className="page-title page-title-compact max-md:text-2xl mt-1">Projects Hub</h1>
          <p className="page-subtitle mt-2 max-md:text-xs max-md:leading-snug">
            Project membership is the gatekeeper for every module. Producers manage creation and approvals, while crew and department users can only request access.
          </p>
        </div>

        <div className="page-toolbar">
          <div className="rounded-[24px] bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            Active project:
            <span className="ml-2 font-semibold text-zinc-900 dark:text-white">
              {projects.find(project => project.id === activeProjectId)?.name ?? 'Not selected'}
            </span>
          </div>
          {producerView && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Create Project
            </button>
          )}
        </div>
      </header>

      {producerView ? (
        <>
          <section className="space-y-5">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Producer View</p>
                <h2 className="section-title">My Projects</h2>
              </div>
            </div>

            {ownedProjects.length === 0 ? (
              <Surface variant="muted" padding="lg">
                <EmptyState icon="workspaces" title="No projects yet" description="Create your first project to unlock the workspace and start inviting departments." />
                <div className="mt-6 flex justify-center">
                  <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </button>
                </div>
              </Surface>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {ownedProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    badgeClass={statusTone[project.status]}
                    membershipLabel="Owner"
                    onOpen={() => openProject(project.id)}
                    openLabel="Enter Workspace"
                  />
                ))}
              </div>
            )}
          </section>

          <section className="pt-4">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Approvals</p>
                <h2 className="section-title">Pending Join Requests</h2>
              </div>
            </div>

            <Surface variant="raised" className="mt-5">
              {relevantJoinRequests.length === 0 ? (
                <EmptyState
                  icon="mark_email_unread"
                  title="No pending requests"
                  description="New project access requests from crew and department leads will appear here."
                />
              ) : (
                <div className="space-y-4">
                  {relevantJoinRequests.map(request => (
                    <JoinRequestRow
                      key={request.id}
                      request={request}
                      projectName={projects.find(project => project.id === request.projectId)?.name ?? 'Project'}
                      onApprove={() => reviewJoinRequestMutation.mutate({ requestId: request.id, status: 'approved' })}
                      onReject={() => reviewJoinRequestMutation.mutate({ requestId: request.id, status: 'rejected' })}
                    />
                  ))}
                </div>
              )}
            </Surface>
          </section>
        </>
      ) : (
        <>
          {accessibleProjectIds.length === 0 && (
            <Surface variant="muted" padding="lg">
              <EmptyState
                icon="workspaces"
                title="You haven't joined a project yet"
                description="Project membership is required before you can enter the main workspace. Join a project to continue."
              />
              <div className="mt-6 flex justify-center">
                <button onClick={() => joinableProject && setSelectedProjectId(joinableProject.id)} className="btn-primary">
                  Join Project
                </button>
              </div>
            </Surface>
          )}

          <section className="space-y-5">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Membership Access</p>
                <h2 className="section-title">Available Projects</h2>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {visibleProjects.map(project => {
                const isMember = membershipProjectIds.has(project.id)
                const request = getRequestForProject(project.id)

                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    badgeClass={statusTone[project.status]}
                    membershipLabel={isMember ? 'Member' : request ? request.status : 'Not joined'}
                    onOpen={isMember ? () => openProject(project.id) : undefined}
                    onJoin={!isMember ? () => setSelectedProjectId(project.id) : undefined}
                    joinDisabled={Boolean(request && request.status === 'pending')}
                    joinLabel={request?.status === 'pending' ? 'Requested' : request?.status === 'approved' ? 'Approved' : 'Join Project'}
                    openLabel="Enter Workspace"
                  />
                )
              })}
            </div>
          </section>
        </>
      )}

      {showCreateModal && (
        <ModalShell title="Create Project" onClose={() => setShowCreateModal(false)}>
          <div className="grid gap-4">
            <label className="auth-field">
              <span className="auth-field-label">Project Name</span>
              <div className="project-modal-input-shell">
                <BriefcaseBusiness className="h-4 w-4 text-zinc-400" />
                <input value={projectName} onChange={event => setProjectName(event.target.value)} className="project-modal-input" placeholder="Midnight Courtyard" />
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="auth-field">
                <span className="auth-field-label">Location</span>
                <div className="project-modal-input-shell">
                  <MapPin className="h-4 w-4 text-zinc-400" />
                  <input value={projectLocation} onChange={event => setProjectLocation(event.target.value)} className="project-modal-input" placeholder="Chennai" />
                </div>
              </label>
              <label className="auth-field">
                <span className="auth-field-label">Status</span>
                <select value={projectStatus} onChange={event => setProjectStatus(event.target.value as ProjectStage)} className="project-modal-select">
                  {PROJECT_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="auth-field">
                <span className="auth-field-label">Budget</span>
                <div className="project-modal-input-shell">
                  <input value={projectBudget} onChange={event => setProjectBudget(event.target.value)} className="project-modal-input" />
                </div>
              </label>
              <label className="auth-field">
                <span className="auth-field-label">Active Crew</span>
                <div className="project-modal-input-shell">
                  <input value={projectCrew} onChange={event => setProjectCrew(event.target.value)} className="project-modal-input" />
                </div>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="auth-field">
                <span className="auth-field-label">Start Date</span>
                <input type="date" value={projectStartDate} onChange={event => setProjectStartDate(event.target.value)} className="project-modal-select" />
              </label>
              <label className="auth-field">
                <span className="auth-field-label">End Date</span>
                <input type="date" value={projectEndDate} onChange={event => setProjectEndDate(event.target.value)} className="project-modal-select" />
              </label>
            </div>

            <label className="auth-field">
              <span className="auth-field-label">OT Rules / FEFSI Settings</span>
              <div className="project-modal-input-shell">
                <Clock3 className="h-4 w-4 text-zinc-400" />
                <input value={projectOtRules} onChange={event => setProjectOtRules(event.target.value)} className="project-modal-input" />
              </div>
            </label>

            <div className="auth-field">
              <span className="auth-field-label">Enabled Departments</span>
              <div className="flex flex-wrap gap-3">
                {DEPARTMENTS.map(department => (
                  <button
                    key={department.id}
                    onClick={() => toggleDepartment(department.id)}
                    className={cn('clay-chip', selectedDepartments.includes(department.id) && 'is-selected')}
                  >
                    {department.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setShowCreateModal(false)} className="clay-ghost-button">Cancel</button>
            <button onClick={createProjectSubmit} className="clay-primary-button">Save Project</button>
          </div>
        </ModalShell>
      )}

      {selectedProject && (
        <ModalShell title={`Request access to ${selectedProject.name}`} onClose={() => setSelectedProjectId(null)}>
          <div className="space-y-5">
            <div className="rounded-[24px] bg-zinc-50 px-5 py-4 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <p className="font-semibold text-zinc-900 dark:text-white">{selectedProject.name}</p>
              <p className="mt-2">{selectedProject.location} - {selectedProject.status}</p>
            </div>

            <label className="auth-field">
              <span className="auth-field-label">Requested Role</span>
              <select value={requestedRole} onChange={event => setRequestedRole(event.target.value as ProjectRequestedRole)} className="project-modal-select">
                {joinRoleOptions.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>

            <label className="auth-field">
              <span className="auth-field-label">Message</span>
              <textarea
                value={requestMessage}
                onChange={event => setRequestMessage(event.target.value)}
                className="project-modal-textarea"
                rows={4}
                placeholder="Add a short note for the producer or project owner."
              />
            </label>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setSelectedProjectId(null)} className="clay-ghost-button">Cancel</button>
            <button onClick={submitJoinRequest} className="clay-primary-button">Send Request</button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  badgeClass,
  membershipLabel,
  onOpen,
  onJoin,
  joinDisabled,
  joinLabel = 'Join Project',
  openLabel = 'Open',
}: {
  project: ProjectRecord
  badgeClass: string
  membershipLabel?: string
  onOpen?: () => void
  onJoin?: () => void
  joinDisabled?: boolean
  joinLabel?: string
  openLabel?: string
}) {
  return (
    <Surface variant="raised" className="rounded-[30px] max-md:rounded-[24px] max-md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4 max-md:gap-2">
        <div>
          <div className={cn('inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] max-md:text-[9px] max-md:px-2 max-md:py-0.5', badgeClass)}>
            {project.status}
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white max-md:mt-3 max-md:text-[18px] max-md:leading-tight">{project.name}</h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-md:mt-1 max-md:text-xs">{project.ownerName} - {project.location}</p>
        </div>

        {membershipLabel && (
          <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/6 dark:text-zinc-300 max-md:text-[9px] max-md:px-2 max-md:py-0.5">
            {membershipLabel}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 max-md:mt-5 max-md:gap-2">
        <MetricTile label="Budget" value={formatCurrency(project.budgetUSD)} icon={<ShieldCheck className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
        <MetricTile label="Active crew" value={`${project.activeCrew}`} icon={<Users className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
        <MetricTile label="Progress" value={`${project.progressPercent}%`} icon={<CheckCircle2 className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm text-zinc-500 dark:text-zinc-400 max-md:mt-5 max-md:gap-1.5">
        {project.enabledDepartments.map(department => (
          <span key={department} className="rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-white/6 max-md:px-2 max-md:py-1 max-md:text-[10px]">{department}</span>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 max-md:mt-5 max-md:gap-2">
        {onOpen && <button onClick={onOpen} className="btn-primary max-md:flex-1 max-md:h-10 max-md:text-xs">{openLabel}</button>}
        {onJoin && (
          <button onClick={onJoin} disabled={joinDisabled} className={cn('btn-soft max-md:flex-1 max-md:h-10 max-md:text-xs', joinDisabled && 'cursor-not-allowed opacity-60')}>
            {joinLabel}
          </button>
        )}
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 max-md:w-full max-md:text-center max-md:text-[9px] max-md:mt-2">
          {formatDate(project.startDate)} - {formatDate(project.endDate)}
        </span>
      </div>
    </Surface>
  )
}

function MetricTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900 max-md:rounded-[16px] max-md:px-3 max-md:py-3">
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 max-md:gap-1.5">{icon}<span className="text-xs font-semibold uppercase tracking-[0.18em] max-md:text-[9px]">{label}</span></div>
      <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white max-md:mt-1.5 max-md:text-sm">{value}</p>
    </div>
  )
}

function JoinRequestRow({
  request,
  projectName,
  onApprove,
  onReject,
}: {
  request: ProjectJoinRequest
  projectName: string
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[26px] bg-zinc-50 px-5 py-5 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{request.userName} requested {request.roleRequested}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{projectName} - {timeAgo(new Date(request.createdAt))}</p>
        {request.message && <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{request.message}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={onReject} className="btn-soft">Reject</button>
        <button onClick={onApprove} className="btn-primary">Approve</button>
      </div>
    </div>
  )
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="clay-panel w-full max-w-3xl p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="clay-icon-button">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
