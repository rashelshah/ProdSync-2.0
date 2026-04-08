declare module 'node:http' {
  export type Server = any

  const http: {
    createServer(...args: any[]): Server
  }

  export default http
}
