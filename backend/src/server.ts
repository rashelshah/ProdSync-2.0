import http from 'node:http'
import { createApp } from './app'
import { startReportAggregator } from './jobs/reportAggregator'
import { initializeRealtimeServer } from './realtime/socket'
import { env } from './utils/env'

const app = createApp()
const server = http.createServer(app)

initializeRealtimeServer(server)
startReportAggregator()

server.listen(env.port, () => {
  console.log(`ProdSync backend listening on port ${env.port}`)
})
