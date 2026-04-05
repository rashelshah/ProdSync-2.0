import http from 'node:http'
import { createApp } from './app'
import { initializeRealtimeServer } from './realtime/socket'
import { env } from './utils/env'

const app = createApp()
const server = http.createServer(app)

initializeRealtimeServer(server)

server.listen(env.port, () => {
  console.log(`ProdSync backend listening on port ${env.port}`)
})
