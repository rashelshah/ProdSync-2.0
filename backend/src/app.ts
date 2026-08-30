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
import { actorsRouter } from './modules/actors/actors.routes'
import { cameraRouter } from './modules/camera/camera.routes'
import { wardrobeRouter } from './modules/wardrobe/wardrobe.routes'
import { accommodationRouter } from './modules/accommodation/accommodation.routes'
import { foodBeveragesRouter } from './modules/food-beverages/food-beverages.routes'
import { reportsRouter } from './modules/reports/reports.routes'
import { mapRouter } from './modules/map/map.routes'
import { locationsRouter } from './modules/locations/locations.routes'
import { HttpError } from './utils/httpError'
import { transportRouter } from './routes/transport.routes'
import { publicRouter } from './routes/public.routes'
import { runtimeProcess } from './utils/runtime'
import { ZodError } from 'zod'

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactSensitive(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      /token|secret|password|authorization|apikey|api_key|access[_-]?key/i.test(key)
        ? '[redacted]'
        : redactSensitive(entry),
    ]),
  )
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }

    for (const key of ['code', 'details', 'hint', 'status', 'statusCode', 'table', 'schema', 'constraint', 'column', 'routine', 'file', 'line', 'position']) {
      const value = (error as unknown as Record<string, unknown>)[key]
      if (value !== undefined) {
        serialized[key] = value
      }
    }

    return serialized
  }

  if (error && typeof error === 'object') {
    return error as Record<string, unknown>
  }

  return error
}

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
  app.use('/api/actors', actorsRouter)
  app.use('/api/camera', cameraRouter)
  app.use('/api/wardrobe', wardrobeRouter)
  app.use('/api/accommodation', accommodationRouter)
  app.use('/api/food-beverages', foodBeveragesRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/map', mapRouter)
  app.use('/api/locations', locationsRouter)
  app.use('/api', transportRouter)
  app.use('/api/public', publicRouter)

  app.use((_req, _res, next) => {
    next(new HttpError(404, 'Route not found.'))
  })

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const dbError = error && typeof error === 'object' ? error as Record<string, unknown> : null
    const dbCode = typeof dbError?.code === 'string' ? dbError.code : null
    const dbConstraint = typeof dbError?.constraint === 'string' ? dbError.constraint : null

    console.error('[backend][error]', {
      method: req.method,
      path: req.path,
      query: redactSensitive(req.query),
      body: redactSensitive(req.body),
      error: serializeError(error),
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

    if (dbCode === '23505') {
      return res.status(409).json({
        error: dbConstraint === 'uq_food_beverage_forecasts_target'
          ? 'A forecast already exists for this project, date, and department.'
          : 'A record with the same details already exists.',
      })
    }

    if (dbCode === '23503') {
      return res.status(400).json({
        error: 'One of the selected records could not be linked. Please refresh and try again.',
      })
    }

    if (dbCode === '42703') {
      return res.status(500).json({
        error: 'The server database schema is missing a required column. Please run the latest migration.',
      })
    }

    return res.status(500).json({
      error: 'Unexpected server error.',
    })
  })

  return app
}

