declare module 'node:buffer' {
  export const Buffer: {
    from(input: any, encoding?: string): any
    byteLength(input: string, encoding?: string): number
  }
}
