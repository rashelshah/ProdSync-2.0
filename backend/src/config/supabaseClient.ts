import { createClient } from '@supabase/supabase-js'
import { env } from '../utils/env'

export const publicClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
