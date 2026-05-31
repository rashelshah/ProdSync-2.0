import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import path from 'node:path'
import { runtimeProcess } from '../../utils/runtime'
import { HttpError } from '../../utils/httpError'

type FileKind = 'jpeg' | 'png' | 'webp' | 'pdf' | 'unknown'

const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

function bytesEqual(buffer: Uint8Array, start: number, expected: number[]) {
  if (buffer.length < start + expected.length) return false
  return expected.every((value, index) => buffer[start + index] === value)
}

function ascii(buffer: Uint8Array, start: number, length: number) {
  return Buffer.from(buffer.slice(start, start + length)).toString('ascii')
}

function detectFileKind(buffer: Uint8Array): FileKind {
  if (bytesEqual(buffer, 0, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (bytesEqual(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') return 'webp'
  if (ascii(buffer, 0, 5) === '%PDF-') return 'pdf'
  return 'unknown'
}

function expectedKindFromMime(mimeType: string): FileKind {
  switch (mimeType) {
    case 'image/jpeg': return 'jpeg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'application/pdf': return 'pdf'
    default: return 'unknown'
  }
}

function expectedKindFromExtension(extension: string): FileKind {
  switch (extension.toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'jpeg'
    case '.png': return 'png'
    case '.webp': return 'webp'
    case '.pdf': return 'pdf'
    default: return 'unknown'
  }
}

export function validateInvoiceUpload(file: Express.Multer.File) {
  if (!file.buffer || file.buffer.length === 0) {
    throw new HttpError(400, 'Upload payload is empty.')
  }

  const extension = path.extname(file.originalname ?? '').toLowerCase()
  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new HttpError(400, `Unsupported file type: ${file.mimetype}`)
  }

  const signatureKind = detectFileKind(file.buffer)
  const mimeKind = expectedKindFromMime(file.mimetype)
  const extensionKind = expectedKindFromExtension(extension)

  if (mimeKind === 'unknown' || extensionKind === 'unknown' || signatureKind === 'unknown') {
    throw new HttpError(400, 'Unknown or mismatched upload extension.')
  }

  if (mimeKind !== signatureKind || extensionKind !== signatureKind) {
    throw new HttpError(400, 'Upload validation failed because file extension, MIME type, and signature do not match.')
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new HttpError(400, 'Invoice uploads must be 25MB or smaller.')
  }

  return { extension }
}

function ensureUploadDirectory() {
  const directory = path.resolve(runtimeProcess.cwd(), 'uploads', 'food-beverages', 'invoices')
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

export function saveInvoiceUpload(file: Express.Multer.File) {
  const extension = path.extname(file.originalname ?? '').toLowerCase()
  const storedName = `${randomUUID()}${extension}`
  const uploadDirectory = ensureUploadDirectory()
  const absolutePath = path.join(uploadDirectory, storedName)
  const buffer = file.buffer ?? Buffer.alloc(0)
  fs.writeFileSync(absolutePath, buffer)

  const storagePath = `food-beverages/invoices/${storedName}`.replace(/\\/g, '/')
  return {
    storedName,
    storagePath,
    url: `/uploads/${storagePath}`,
    absolutePath,
  }
}

export function deleteStoredUpload(storagePath: string | null | undefined) {
  if (!storagePath) return
  const absolutePath = path.resolve(runtimeProcess.cwd(), 'uploads', storagePath)
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath)
  }
}
