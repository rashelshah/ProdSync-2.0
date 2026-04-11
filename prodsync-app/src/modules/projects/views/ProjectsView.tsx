import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, Clock3, MapPin, Plus, ShieldCheck, Users } from 'lucide-react'
import { Surface } from '@/components/shared/Surface'
import { EmptyState, LoadingState } from '@/components/system/SystemStates'
import { invalidateProjectData } from '@/context/project-sync'
import { getDefaultWorkspacePath, isProducerRole } from '@/features/auth/access-rules'
import { getProjectRoleTitle, getRoleOptionsForDepartment } from '@/features/auth/onboarding'
import { useAuthStore } from '@/features/auth/auth.store'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { useProjectsStore } from '@/features/projects/projects.store'
import { resolveErrorMessage, showError, showLoading, showSuccess } from '@/lib/toast'
import { projectsService, type ProjectPreview } from '@/services/projects.service'
import { cn, formatCurrency, formatDate, timeAgo } from '@/utils'
import type { ProjectCurrency, ProjectDepartment, ProjectJoinRequest, ProjectRecord, ProjectRequestedRole, ProjectStage } from '@/types'

const PROJECT_STATUSES: ProjectStage[] = ['pre-production', 'shooting', 'post']
const DEPARTMENTS: { id: ProjectDepartment; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'art', label: 'Art' },
  { id: 'transport', label: 'Transport' },
  { id: 'production', label: 'Production' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'post', label: 'Post' },
]
const PROJECT_CURRENCIES: ProjectCurrency[] = ['INR', 'USD', 'EUR']

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
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [previewProject, setPreviewProject] = useState<ProjectPreview | null>(null)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinDepartment, setJoinDepartment] = useState<ProjectDepartment>('production')
  const [joinRole, setJoinRole] = useState<ProjectRequestedRole>('Crew Member')

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
  const [projectCurrency, setProjectCurrency] = useState<ProjectCurrency>('INR')
  const [projectCrew, setProjectCrew] = useState('')
  const [projectStartDate, setProjectStartDate] = useState('')
  const [projectEndDate, setProjectEndDate] = useState('')
  const [projectOtRules, setProjectOtRules] = useState('')
  const [selectedDepartments, setSelectedDepartments] = useState<ProjectDepartment[]>([])
  const [projectAction, setProjectAction] = useState<string | null>(null)

  const currentUser = user ?? {
    id: '',
    name: '',
    role: 'Crew' as const,
    roleLabel: 'Crew Member',
    projectRoleTitle: 'Crew Member' as ProjectRequestedRole,
    departmentId: 'production' as ProjectDepartment,
  }

  const ownedProjects = projects.filter(project => project.ownerId === currentUser.id)
  const producerView = isProducerRole(currentUser.role) || ownedProjects.length > 0
  const visibleProjects = producerView ? projects : projects
  const membershipProjectIds = new Set(projectMembers.filter(member => member.userId === currentUser.id).map(member => member.projectId))
  const accessibleProjectIds = Array.from(new Set([...ownedProjects.map(project => project.id), ...Array.from(membershipProjectIds)]))
  const joinRoleOptions = getRoleOptionsForDepartment(joinDepartment).map(option => option.id)
  const relevantJoinRequests = producerView
    ? joinRequests.filter(request => request.status === 'pending')
    : joinRequests.filter(request => request.userId === currentUser.id && request.status === 'pending')

  const selectedProject = selectedProjectId ? visibleProjects.find(project => project.id === selectedProjectId) ?? null : null

  const createProjectMutation = useMutation({
    mutationFn: projectsService.createProject,
    onSuccess: async (project) => {
      if (project) {
        setActiveProject(project.id, project.currency)
      }

      setShowCreateModal(false)
      setProjectName('')
      setProjectLocation('')
      setProjectBudget('')
      setProjectCurrency('INR')
      setProjectCrew('')
      setProjectStartDate('')
      setProjectEndDate('')
      setProjectOtRules('')
      setSelectedDepartments([])

      await invalidateProjectData(queryClient, {
        projectId: project?.id,
        userId: user?.id,
      })
    },
  })

  const requestJoinMutation = useMutation({
    mutationFn: projectsService.createJoinRequest,
    onSuccess: async () => {
      setSelectedProjectId(null)
      setRequestMessage('')
      await invalidateProjectData(queryClient, { userId: user?.id })
    },
  })

  async function verifyProjectCode(code: string) {
    if (!code.trim()) return
    setIsVerifyingCode(true)
    try {
      // Basic check if it's a full URL
      const upperCode = code.toUpperCase()
      const token = upperCode.includes('/JOIN/') ? upperCode.split('/JOIN/')[1].trim() : code.trim()
      const preview = await projectsService.previewProject(token)
      if (preview) {
        setPreviewProject(preview)
        // If they're already a member, we handle it
        if (membershipProjectIds.has(preview.id)) {
           showError('You are already a member of this project.', { id: 'join-code' })
           setPreviewProject(null)
           setJoinCodeInput('')
        }
      }
    } catch (err: any) {
      showError(resolveErrorMessage(err, 'Invalid or expired project code'), { id: 'join-code' })
      setPreviewProject(null)
    } finally {
      setIsVerifyingCode(false)
    }
  }

  async function performJoin() {
    if (!previewProject) return

    void runProjectAction(
      async () => {
        const upperCode = joinCodeInput.toUpperCase()
        const token = upperCode.includes('/JOIN/') ? upperCode.split('/JOIN/')[1].trim() : joinCodeInput.trim()
        const joined = await projectsService.joinProject(token, joinRole, joinDepartment)
        if (joined?.project) {
          setShowJoinModal(false)
          setPreviewProject(null)
          setJoinCodeInput('')
          setActiveProject(joined.project.id, joined.project.currency)
          await invalidateProjectData(queryClient, { userId: user?.id })
          navigate(getDefaultWorkspacePath(currentUser))
        }
      },
      {
        actionKey: 'project-join',
        loadingMessage: 'Joining project...',
        successMessage: 'Successfully joined project!',
        errorMessage: 'Could not join project at this time.',
      }
    )
  }

  const reviewJoinRequestMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'approved' | 'rejected' }) =>
      projectsService.reviewJoinRequest(requestId, status),
    onSuccess: async () => {
      await invalidateProjectData(queryClient, { userId: user?.id })
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
    const nextProject = projects.find(project => project.id === accessibleProjectIds[0]) ?? null
    setActiveProject(accessibleProjectIds[0] ?? null, nextProject?.currency ?? 'INR')
  }, [accessibleProjectIds, activeProjectId, projects, setActiveProject, user])

  if (!user) return null

  async function runProjectAction<T>(
    action: () => Promise<T>,
    options: {
      actionKey: string
      loadingMessage: string
      successMessage: string
      errorMessage: string
    },
  ) {
    setProjectAction(options.actionKey)
    showLoading(options.loadingMessage, { id: options.actionKey })

    try {
      const result = await action()
      showSuccess(options.successMessage, { id: options.actionKey })
      return result
    } catch (error) {
      showError(resolveErrorMessage(error, options.errorMessage), { id: options.actionKey })
      throw error
    } finally {
      setProjectAction(null)
    }
  }

  function openProject(projectId: string) {
    const project = projects.find(item => item.id === projectId) ?? visibleProjects.find(item => item.id === projectId) ?? null
    setActiveProject(projectId, project?.currency ?? 'INR')
    navigate(getDefaultWorkspacePath(currentUser))
  }

  function createProjectSubmit() {
    if (!projectName.trim()) {
      showError('Project name is required.', { id: 'project-create' })
      return
    }

    void runProjectAction(
      () => createProjectMutation.mutateAsync({
        name: projectName.trim(),
        location: projectLocation.trim(),
        status: projectStatus,
        budgetUSD: Number(projectBudget) || 0,
        currency: projectCurrency,
        activeCrew: Number(projectCrew) || 0,
        startDate: projectStartDate,
        endDate: projectEndDate,
        enabledDepartments: selectedDepartments,
        otRulesLabel: projectOtRules.trim(),
      }),
      {
        actionKey: 'project-create',
        loadingMessage: 'Creating project...',
        successMessage: 'Project created successfully.',
        errorMessage: 'Project could not be created.',
      },
    )
  }

  function submitJoinRequest() {
    if (!selectedProject) {
      showError('Select a project before sending a request.', { id: 'project-join-request' })
      return
    }

    void runProjectAction(
      () => requestJoinMutation.mutateAsync({
        projectId: selectedProject.id,
        roleRequested: requestedRole,
        message: requestMessage.trim() || undefined,
      }),
      {
        actionKey: 'project-join-request',
        loadingMessage: 'Sending access request...',
        successMessage: 'Access request sent.',
        errorMessage: 'Access request could not be sent.',
      },
    )
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
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Create Project
          </button>
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
                      onApprove={() => {
                        void runProjectAction(
                          () => reviewJoinRequestMutation.mutateAsync({ requestId: request.id, status: 'approved' }),
                          {
                            actionKey: `project-review-${request.id}`,
                            loadingMessage: 'Approving join request...',
                            successMessage: 'Approved successfully',
                            errorMessage: 'Join request approval failed.',
                          },
                        )
                      }}
                      onReject={() => {
                        void runProjectAction(
                          () => reviewJoinRequestMutation.mutateAsync({ requestId: request.id, status: 'rejected' }),
                          {
                            actionKey: `project-review-${request.id}`,
                            loadingMessage: 'Flagging join request...',
                            successMessage: 'Request flagged',
                            errorMessage: 'Join request could not be flagged.',
                          },
                        )
                      }}
                      isBusy={projectAction === `project-review-${request.id}`}
                    />
                  ))}
                </div>
              )}
            </Surface>
          </section>
        </>
      ) : (
        <div className="space-y-8">
          {(accessibleProjectIds.length > 0 || relevantJoinRequests.length > 0) && (
            <section className="space-y-5">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Membership Access</p>
                  <h2 className="section-title">Your Projects</h2>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                {visibleProjects
                  .filter(project => membershipProjectIds.has(project.id))
                  .map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      badgeClass={statusTone[project.status]}
                      membershipLabel="Member"
                      onOpen={() => openProject(project.id)}
                      openLabel="Enter Workspace"
                    />
                  ))}
                {relevantJoinRequests
                  .filter(request => request.projectDetails)
                  .map(request => (
                    <ProjectCard
                      key={request.id}
                      project={request.projectDetails!}
                      badgeClass={statusTone[request.projectDetails!.status] ?? 'bg-zinc-100 text-zinc-700'}
                      membershipLabel="Pending"
                      joinDisabled={true}
                      joinLabel="Request Submitted"
                      onJoin={() => {}}
                    />
                  ))}
              </div>
            </section>
          )}

          <section className="space-y-5">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Join Workspace</p>
                <h2 className="section-title">Join a Project</h2>
              </div>
            </div>

            {previewProject ? (
              <ProjectPreviewCard
                preview={previewProject}
                onJoin={() => setShowJoinModal(true)}
                onCancel={() => {
                  setPreviewProject(null)
                  setJoinCodeInput('')
                }}
              />
            ) : (
              <Surface variant={accessibleProjectIds.length === 0 ? 'muted' : 'raised'} padding="lg" className="rounded-[30px]">
                {accessibleProjectIds.length === 0 && (
                  <EmptyState
                    icon="workspaces"
                    title="Join a Project"
                    description="Enter a project code or paste an invite link to get started."
                  />
                )}
                
                <div className={cn('mx-auto max-w-sm space-y-4 flex flex-col', accessibleProjectIds.length === 0 ? 'mt-8' : 'mt-2')}>
                  <input
                    value={joinCodeInput}
                    onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter project code or link"
                    className="project-modal-input text-center text-lg tracking-widest uppercase disabled:opacity-50 font-medium"
                    disabled={isVerifyingCode}
                    autoFocus={accessibleProjectIds.length === 0}
                  />
                  <button
                    onClick={() => verifyProjectCode(joinCodeInput)}
                    disabled={isVerifyingCode || joinCodeInput.trim().length < 3}
                    className="btn-primary w-full h-12 text-base"
                  >
                    {isVerifyingCode ? <span className="ui-spinner" /> : null}
                    {isVerifyingCode ? 'Verifying...' : 'Next'}
                  </button>
                </div>
              </Surface>
            )}
          </section>
        </div>
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
                <span className="auth-field-label">Currency</span>
                <select value={projectCurrency} onChange={event => setProjectCurrency(event.target.value as ProjectCurrency)} className="project-modal-select">
                  {PROJECT_CURRENCIES.map(currency => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                    className={cn('project-department-chip', selectedDepartments.includes(department.id) && 'is-selected')}
                  >
                    {department.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setShowCreateModal(false)} className="clay-ghost-button" disabled={projectAction === 'project-create'}>Cancel</button>
            <button onClick={createProjectSubmit} className="clay-primary-button" disabled={projectAction === 'project-create'}>
              {projectAction === 'project-create' ? <span className="ui-spinner" /> : null}
              {projectAction === 'project-create' ? 'Saving Project...' : 'Save Project'}
            </button>
          </div>
        </ModalShell>
      )}

      {showJoinModal && previewProject && (
        <ModalShell title={`Join ${previewProject.name}`} onClose={() => setShowJoinModal(false)}>
          <div className="space-y-5">
            <div className="rounded-[24px] bg-zinc-50 px-5 py-4 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <p className="font-semibold text-zinc-900 dark:text-white">{previewProject.name}</p>
              <p className="mt-2">{previewProject.location} - {previewProject.status}</p>
            </div>

            <label className="auth-field">
              <span className="auth-field-label">Department</span>
              <select 
                value={joinDepartment} 
                onChange={event => {
                  const dept = event.target.value as ProjectDepartment
                  setJoinDepartment(dept)
                  setJoinRole(getRoleOptionsForDepartment(dept)[0].id)
                }} 
                className="project-modal-select"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.label}</option>
                ))}
              </select>
            </label>

            <label className="auth-field">
              <span className="auth-field-label">Role</span>
              <select value={joinRole} onChange={event => setJoinRole(event.target.value as ProjectRequestedRole)} className="project-modal-select">
                {joinRoleOptions.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setShowJoinModal(false)} className="clay-ghost-button" disabled={projectAction === 'project-join'}>Cancel</button>
            <button onClick={performJoin} className="clay-primary-button" disabled={projectAction === 'project-join'}>
              {projectAction === 'project-join' ? <span className="ui-spinner" /> : null}
              {projectAction === 'project-join' ? 'Joining...' : 'Confirm Join'}
            </button>
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
          <div className="flex flex-wrap gap-2">
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/6 dark:text-zinc-300 max-md:text-[9px] max-md:px-2 max-md:py-0.5">
              {membershipLabel}
            </div>
            <div className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-zinc-100 dark:text-zinc-900 max-md:text-[9px] max-md:px-2 max-md:py-0.5">
              {project.currency}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 max-md:mt-5 max-md:gap-2">
        <MetricTile label="Budget" value={formatCurrency(project.budgetUSD, project.currency)} icon={<ShieldCheck className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
        <MetricTile label="Active crew" value={`${project.activeCrew}`} icon={<Users className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
        <MetricTile label="Progress" value={`${project.progressPercent}%`} icon={<CheckCircle2 className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
      </div>

      <div className="mt-5 rounded-[24px] bg-zinc-50 px-4 py-4 dark:bg-zinc-900 max-md:rounded-[18px] max-md:px-3 max-md:py-3">
        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 max-md:text-[9px]">
          <span>Financial Progress</span>
          <span>{project.progressPercent}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/10">
          <div
            className={cn(
              'h-full rounded-full transition-[width,background-color,box-shadow] duration-200',
              project.isOverBudget
                ? 'bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.32)]'
                : 'bg-orange-500 shadow-[0_0_18px_rgba(249,115,22,0.28)]',
            )}
            style={{ width: `${Math.max(0, Math.min(project.progressPercent, 100))}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 max-md:text-xs">
          {formatCurrency(project.spentAmount, project.currency)} spent against {formatCurrency(project.budgetUSD, project.currency)} budget.
        </p>
        {project.isOverBudget && (
          <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 max-md:text-xs">
            Spend has crossed the allocated budget for this project.
          </p>
        )}
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
  isBusy = false,
}: {
  request: ProjectJoinRequest
  projectName: string
  onApprove: () => void
  onReject: () => void
  isBusy?: boolean
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[26px] bg-zinc-50 px-5 py-5 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{request.userName} requested {request.roleRequested}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{projectName} - {timeAgo(new Date(request.createdAt))}</p>
        {request.message && <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{request.message}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={onReject} className="btn-soft" disabled={isBusy}>
          {isBusy ? 'Working...' : 'Reject'}
        </button>
        <button onClick={onApprove} className="btn-primary" disabled={isBusy}>
          {isBusy ? 'Working...' : 'Approve'}
        </button>
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

function ProjectPreviewCard({
  preview,
  onJoin,
  onCancel,
}: {
  preview: ProjectPreview
  onJoin: () => void
  onCancel: () => void
}) {
  return (
    <Surface variant="raised" className="rounded-[30px] max-md:rounded-[24px] max-md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4 max-md:gap-2">
        <div>
          <div className={cn('inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] max-md:text-[9px] max-md:px-2 max-md:py-0.5', statusTone[preview.status])}>
            {preview.status}
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white max-md:mt-3 max-md:text-[18px] max-md:leading-tight">{preview.name}</h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-md:mt-1 max-md:text-xs">Location: {preview.location}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 max-md:mt-5 max-md:gap-2">
        <MetricTile label="Active crew" value={`${preview.activeCrew}`} icon={<Users className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
        <MetricTile label="Progress" value={`${preview.progressPercent}%`} icon={<CheckCircle2 className="h-4 w-4 max-md:h-3 max-md:w-3" />} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm text-zinc-500 dark:text-zinc-400 max-md:mt-5 max-md:gap-1.5">
        {preview.enabledDepartments.map(department => (
          <span key={department} className="rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-white/6 max-md:px-2 max-md:py-1 max-md:text-[10px]">{department}</span>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 max-md:mt-5 max-md:gap-2">
        <button onClick={onCancel} className="btn-soft max-md:flex-1 max-md:h-10 max-md:text-xs">
          Cancel
        </button>
        <button onClick={onJoin} className="btn-primary max-md:flex-1 max-md:h-10 max-md:text-xs">
          Join Project
        </button>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 max-md:w-full max-md:text-center max-md:text-[9px] max-md:mt-2">
          {formatDate(preview.startDate)} - {formatDate(preview.endDate)}
        </span>
      </div>
    </Surface>
  )
}
