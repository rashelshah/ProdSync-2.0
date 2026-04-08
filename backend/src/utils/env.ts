import { config } from 'dotenv'
import { runtimeProcess } from './runtime'

config()

function requireEnv(name: string) {
  const value = runtimeProcess.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const env = {
  nodeEnv: runtimeProcess.env.NODE_ENV ?? 'development',
  port: Number(runtimeProcess.env.PORT ?? 5000),
  jwtSecret: requireEnv('JWT_SECRET'),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  clientOrigin: runtimeProcess.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  redisUrl: runtimeProcess.env.REDIS_URL ?? '',
  mapboxAccessToken: runtimeProcess.env.MAPBOX_TOKEN ?? runtimeProcess.env.MAPBOX_ACCESS_TOKEN ?? '',
  mapboxStaticStyleOwner: runtimeProcess.env.MAPBOX_STATIC_STYLE_OWNER ?? 'mapbox',
  mapboxStaticStyleId: runtimeProcess.env.MAPBOX_STATIC_STYLE_ID ?? 'streets-v12',
  mapboxDailyLimit: Math.max(1, Number(runtimeProcess.env.MAPBOX_DAILY_LIMIT ?? 1500)),
  mapboxMonthlyLimit: Math.max(1, Number(runtimeProcess.env.MAPBOX_MONTHLY_LIMIT ?? 30000)),
  transportTrackingIntervalMs: Math.max(5_000, Number(runtimeProcess.env.TRANSPORT_TRACKING_INTERVAL_MS ?? 10_000)),
  transportTrackingMinDistanceMeters: Math.max(10, Number(runtimeProcess.env.TRANSPORT_TRACKING_MIN_DISTANCE_METERS ?? 20)),
}

export function isProduction() {
  return env.nodeEnv === 'production'
}
