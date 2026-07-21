import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const env = {
  ...process.env,
  NAPI_RS_FORCE_WASI: '1',
}

function run(command, args) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: path.resolve(scriptDir, '..'),
    env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run(path.resolve(scriptDir, '../node_modules/typescript/bin/tsc'), ['-b', '--pretty', 'false'])
run(path.resolve(scriptDir, '../node_modules/vite/bin/vite.js'), ['build', '--configLoader', 'native'])
