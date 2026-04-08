declare module 'node:path' {
  const path: {
    resolve(...parts: string[]): string
    basename(input: string, suffix?: string): string
    extname(input: string): string
    posix: {
      join(...parts: string[]): string
    }
  }

  export default path
}
