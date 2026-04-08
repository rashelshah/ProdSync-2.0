type RuntimeProcess = {
  env: Record<string, string | undefined>
  cwd: () => string
}

type RuntimeBuffer = {
  from(input: any, encoding?: string): any
  byteLength(input: string, encoding?: string): number
}

const globalWithRuntime = globalThis as typeof globalThis & {
  process?: Partial<RuntimeProcess>
  Buffer?: RuntimeBuffer
}

export const runtimeProcess: RuntimeProcess = {
  env: globalWithRuntime.process?.env ?? {},
  cwd: typeof globalWithRuntime.process?.cwd === 'function' ? () => globalWithRuntime.process?.cwd?.() ?? '.' : () => '.',
}

export const runtimeBuffer: RuntimeBuffer = globalWithRuntime.Buffer ?? {
  from: (input: any) => input,
  byteLength: (input: string) => input.length,
}
