import path from 'node:path'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { authRouter } from './modules/auth/auth.routes'
import { usersRouter } from './modules/users/users.routes'
import { projectsRouter } from './modules/projects/projects.routes'
import { rolesRouter } from './modules/roles/roles.routes'
import { permissionsRouter } from './modules/permissions/permissions.routes'
import { requestsRouter } from './modules/requests/requests.routes'
import { crewRouter } from './modules/crew/crew.routes'
import { alertsRouter } from './modules/alerts/alerts.routes'
import { activityRouter } from './modules/activity/activity.routes'
import { artRouter } from './modules/art/art.routes'
import { cameraRouter } from './modules/camera/camera.routes'
import { wardrobeRouter } from './modules/wardrobe/wardrobe.routes'
import { reportsRouter } from './modules/reports/reports.routes'
import { HttpError } from './utils/httpError'
import { transportRouter } from './routes/transport.routes'
import { runtimeProcess } from './utils/runtime'
import { ZodError } from 'zod'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use('/uploads', express.static(path.resolve(runtimeProcess.cwd(), 'uploads')))

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'prodsync-backend',
      message: 'ProdSync backend is running.',
      health: '/api/health',
    })
  })

  app.head('/', (_req, res) => {
    res.status(200).end()
  })

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'prodsync-backend',
    })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/roles', rolesRouter)
  app.use('/api/permissions', permissionsRouter)
  app.use('/api/requests', requestsRouter)
  app.use('/api/crew', crewRouter)
  app.use('/api/alerts', alertsRouter)
  app.use('/api/activity', activityRouter)
  app.use('/api/art', artRouter)
  app.use('/api/camera', cameraRouter)
  app.use('/api/wardrobe', wardrobeRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api', transportRouter)

  app.use((_req, _res, next) => {
    next(new HttpError(404, 'Route not found.'))
  })

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error('[backend][error]', {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: error.flatten(),
      })
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        error: error.message,
        details: error.details ?? null,
      })
    }

    if (error instanceof Error) {
      return res.status(500).json({
        error: error.message,
        stack: runtimeProcess.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }

    return res.status(500).json({
      error: 'Unexpected server error.',
    })
  })

  return app
}
