declare module 'express' {
  export interface Request {
    [key: string]: any
    authUser?: Express.Request['authUser']
    projectAccess?: Express.Request['projectAccess']
    body: any
    query: any
    params: any
    file?: Express.Multer.File
    files?: Record<string, Express.Multer.File[]> | Express.Multer.File[]
    headers: Record<string, string | undefined> & {
      authorization?: string
    }
    method: string
    path: string
  }

  export interface Response {
    [key: string]: any
    status(code: number): Response
    json(body?: unknown): Response
    send(body?: unknown): Response
    end(body?: unknown): Response
  }

  export type NextFunction = (error?: unknown) => void

  export interface RouterInstance {
    use(...args: any[]): RouterInstance
    get(...args: any[]): RouterInstance
    post(...args: any[]): RouterInstance
    put(...args: any[]): RouterInstance
    patch(...args: any[]): RouterInstance
    delete(...args: any[]): RouterInstance
  }

  interface ExpressFactory {
    (): any
    json(options?: any): any
    urlencoded(options?: any): any
    static(root: string, options?: any): any
    Router(): RouterInstance
  }

  const express: ExpressFactory & {
    Request: Request
    Response: Response
    NextFunction: NextFunction
  }

  export function Router(): RouterInstance
  export default express
}
