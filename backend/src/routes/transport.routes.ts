import { Router } from 'express'
import { alertRouter } from './alert.routes'
import { fuelRouter } from './fuel.routes'
import { gpsRouter } from './gps.routes'
import { locationRouter } from './location.routes'
import { trackingRouter } from './tracking.routes'
import { tripRouter } from './trip.routes'
import { vehicleRouter } from './vehicle.routes'

export const transportRouter = Router()

transportRouter.use('/vehicles', vehicleRouter)
transportRouter.use('/trips', tripRouter)
transportRouter.use('/fuel', fuelRouter)
transportRouter.use('/transport-alerts', alertRouter)
transportRouter.use('/gps-logs', gpsRouter)
transportRouter.use('/location', locationRouter)
transportRouter.use('/tracking', trackingRouter)
