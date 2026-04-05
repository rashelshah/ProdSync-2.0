import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { authMiddleware } from '../../middleware/auth.middleware'

export const authRouter = Router()

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({
      user: req.authUser,
    })
  }),
)

