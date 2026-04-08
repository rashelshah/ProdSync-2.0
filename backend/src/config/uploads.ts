import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { HttpError } from '../utils/httpError'
import { runtimeProcess } from '../utils/runtime'

const uploadsRoot = path.resolve(runtimeProcess.cwd(), 'uploads', 'transport')

fs.mkdirSync(uploadsRoot, { recursive: true })

function sanitizeFileName(name: string) {
  const extension = path.extname(name).toLowerCase()
  const baseName = path.basename(name, extension).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${baseName || 'upload'}-${Date.now()}${extension}`
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsRoot)
  },
  filename: (_req, file, callback) => {
    callback(null, sanitizeFileName(file.originalname))
  },
})

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export const transportUpload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, `Unsupported file type: ${file.mimetype}`))
      return
    }

    callback(null, true)
  },
})
