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
}

export function isProduction() {
  return env.nodeEnv === 'production'
}
