declare module 'dotenv' {
  export function config(options?: any): { parsed?: Record<string, string> }
}
