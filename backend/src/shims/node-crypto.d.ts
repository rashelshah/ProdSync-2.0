declare module 'node:crypto' {
  export function randomUUID(): string
  export function createHash(algorithm: string): {
    update(value: string): any
    digest(encoding?: string): string
  }
}
