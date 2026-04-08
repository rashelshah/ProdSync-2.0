declare module 'socket.io' {
  export class Server {
    constructor(server?: any, options?: any)
    use(handler: any): this
    on(event: string, handler: any): this
    to(room: string): { emit: (...args: any[]) => void }
    emit(...args: any[]): boolean
  }
}
