import type { AuthenticatedUserContext } from '../services/auth.service'

declare global {
  function require(name: string): any

  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        destination?: string
        filename?: string
        path: string
        buffer?: Uint8Array
        [key: string]: unknown
      }
    }

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
