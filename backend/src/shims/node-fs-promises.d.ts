declare module 'node:fs/promises' {
  const fs: {
    readFile(path: string): Promise<Uint8Array>
    unlink(path: string): Promise<void>
  }

  export default fs
}
