import type { AuthenticatedUserContext } from '../services/auth.service'

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUserContext
      projectAccess?: {
      projectId: string
      membershipRole: string | null
      projectRole: string | null
      department: string | null
      isOwner: boolean
    }
  }
}
}

export {}
