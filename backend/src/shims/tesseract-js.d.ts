declare module 'tesseract.js' {
  export function recognize(input: unknown, language?: string, options?: any): Promise<{
    data: {
      text?: string
    }
  }>
}
