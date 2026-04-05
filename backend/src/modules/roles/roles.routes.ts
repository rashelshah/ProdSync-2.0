import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { roleMiddleware } from '../../middleware/role.middleware'

export const rolesRouter = Router()

rolesRouter.get('/matrix', authMiddleware, roleMiddleware(['EP', 'LINE_PRODUCER']), (_req, res) => {
  res.json({
    roles: ['EP', 'LINE_PRODUCER', 'HOD', 'SUPERVISOR', 'CREW', 'DRIVER', 'DATA_WRANGLER'],
  })
})
