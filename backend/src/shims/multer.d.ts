declare module 'multer' {
  interface MulterInstance {
    single(fieldName: string): any
    fields(fields: Array<{ name: string; maxCount?: number }>): any
    array(fieldName: string, maxCount?: number): any
    any(): any
  }

  interface MulterFactory {
    (options?: any): MulterInstance
    diskStorage(options: any): any
    memoryStorage(): any
  }

  const multer: MulterFactory
  export default multer
}
