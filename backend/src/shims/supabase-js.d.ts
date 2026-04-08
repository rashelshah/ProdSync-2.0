declare module '@supabase/supabase-js' {
  export interface User {
    id: string
    email?: string | null
    user_metadata?: Record<string, any>
  }

  export function createClient(...args: any[]): any
}
