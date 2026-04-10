import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../utils/asyncHandler'
import { authMiddleware } from '../../middleware/auth.middleware'
import { completeGoogleOnboarding, getUserFromAccessToken, syncGoogleLogin, type AuthenticatedUserContext } from '../../services/auth.service'
import { HttpError } from '../../utils/httpError'

export const authRouter = Router()

const googleOnboardingSchema = z.object({
  departmentId: z.enum(['camera', 'art', 'transport', 'production', 'wardrobe', 'post']),
  projectRoleTitle: z.enum([
    'Executive Producer',
    'Line Producer',
    'Production Manager',
    '1st AD',
    'DOP',
    '1st AC',
    'Camera Operator',
    'Art Director',
    'Art Assistant',
    'Transport Captain',
    'Driver',
    'Editor',
    'Colorist',
    'Costume Supervisor',
    'Wardrobe Stylist',
    'Crew Member',
    'Data Wrangler',
  ]),
})

function getBearerToken(headerValue?: string) {
  if (!headerValue?.startsWith('Bearer ')) {
    return null
  }

  return headerValue.slice('Bearer '.length).trim()
}

function serializeAuthUser(user: AuthenticatedUserContext) {
  return {
    id: user.id,
    authUserId: user.authUserId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    department: user.department,
    projectRoleTitle: user.projectRoleTitle,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
    isGoogleLinked: user.isGoogleLinked,
    onboardingCompletedAt: user.onboardingCompletedAt,
  }
}

async function refreshAuthUserFromRequest(authorizationHeader?: string) {
  const accessToken = getBearerToken(authorizationHeader)

  if (!accessToken) {
    throw new HttpError(401, 'Authorization header missing bearer token.')
  }

  return getUserFromAccessToken(accessToken)
}

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({
      user: serializeAuthUser(req.authUser!),
      needsOnboarding: req.authUser?.needsOnboarding ?? false,
      sessionProvider: req.authUser?.sessionProvider ?? null,
    })
  }),
)

authRouter.post(
  '/google-login',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.authUser) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    await syncGoogleLogin(req.authUser)
    const refreshedUser = await refreshAuthUserFromRequest(req.headers.authorization)

    res.json({
      user: serializeAuthUser(refreshedUser),
      needsOnboarding: refreshedUser.needsOnboarding,
      isNewUser: refreshedUser.needsOnboarding,
      sessionProvider: refreshedUser.sessionProvider,
    })
  }),
)

authRouter.post(
  '/google-onboarding',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.authUser) {
      throw new HttpError(401, 'Authenticated user context is missing.')
    }

    const payload = googleOnboardingSchema.parse(req.body)
    await completeGoogleOnboarding(req.authUser, payload)
    const refreshedUser = await refreshAuthUserFromRequest(req.headers.authorization)

    res.json({
      user: serializeAuthUser(refreshedUser),
      needsOnboarding: refreshedUser.needsOnboarding,
      sessionProvider: refreshedUser.sessionProvider,
    })
  }),
)
