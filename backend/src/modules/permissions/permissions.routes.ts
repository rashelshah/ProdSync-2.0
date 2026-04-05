import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'

export const permissionsRouter = Router()

permissionsRouter.get('/me', authMiddleware, (req, res) => {
  res.json({
    role: req.authUser?.role ?? null,
    projectRoleTitle: req.authUser?.projectRoleTitle ?? null,
    department: req.authUser?.department ?? null,
  })
})

