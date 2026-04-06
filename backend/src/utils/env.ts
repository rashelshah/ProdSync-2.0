import { config } from 'dotenv'

config()

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  jwtSecret: requireEnv('JWT_SECRET'),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  redisUrl: process.env.REDIS_URL ?? '',
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN ?? '',
  mapboxStaticStyleOwner: process.env.MAPBOX_STATIC_STYLE_OWNER ?? 'mapbox',
  mapboxStaticStyleId: process.env.MAPBOX_STATIC_STYLE_ID ?? 'streets-v12',
  mapboxDailyLimit: Math.max(1, Number(process.env.MAPBOX_DAILY_LIMIT ?? 1500)),
  mapboxMonthlyLimit: Math.max(1, Number(process.env.MAPBOX_MONTHLY_LIMIT ?? 30000)),
  transportTrackingIntervalMs: Math.max(5_000, Number(process.env.TRANSPORT_TRACKING_INTERVAL_MS ?? 10_000)),
  transportTrackingMinDistanceMeters: Math.max(10, Number(process.env.TRANSPORT_TRACKING_MIN_DISTANCE_METERS ?? 20)),
}

export function isProduction() {
  return env.nodeEnv === 'production'
}
