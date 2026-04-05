import { createClient } from '@supabase/supabase-js'
import { env } from '../utils/env'

console.log('[supabase] clients initialized', {
  urlHost: new URL(env.supabaseUrl).host,
})

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
