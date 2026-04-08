declare module 'node:fs' {
  const fs: {
    mkdirSync(path: string, options?: any): void
  }

  export default fs
}
