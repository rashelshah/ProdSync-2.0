import multer from 'multer'
import { HttpError } from '../utils/httpError'

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export const actorLookUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, `Unsupported actor look image type: ${file.mimetype}`))
      return
    }

    callback(null, true)
  },
})
