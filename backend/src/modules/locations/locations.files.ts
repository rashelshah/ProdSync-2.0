import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import path from 'node:path'
import { runtimeProcess } from '../../utils/runtime'
import { HttpError } from '../../utils/httpError'

type UploadContext = 'media' | 'document'
type FileKind = 'jpeg' | 'png' | 'webp' | 'mp4' | 'webm' | 'pdf' | 'zip' | 'rar' | 'seven_zip' | 'exe' | 'gzip' | 'tar' | 'unknown'

const allowedMediaMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
const allowedDocumentMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const blockedExtensions = new Set(['.zip', '.rar', '.7z', '.exe', '.dll', '.bat', '.apk', '.iso', '.tar', '.gz'])

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
  if (ascii(buffer, 4, 4) === 'ftyp') return 'mp4'
  if (bytesEqual(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm'
  if (bytesEqual(buffer, 0, [0x50, 0x4b, 0x03, 0x04])) return 'zip'
  if (ascii(buffer, 0, 7) === 'Rar!\x1a\x07') return 'rar'
  if (bytesEqual(buffer, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return 'seven_zip'
  if (bytesEqual(buffer, 0, [0x4d, 0x5a])) return 'exe'
  if (bytesEqual(buffer, 0, [0x1f, 0x8b])) return 'gzip'
  if (ascii(buffer, 257, 5) === 'ustar') return 'tar'
  return 'unknown'
}

function expectedKindFromMime(mimeType: string): FileKind {
  switch (mimeType) {
    case 'image/jpeg': return 'jpeg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'video/mp4': return 'mp4'
    case 'video/webm': return 'webm'
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
    case '.mp4': return 'mp4'
    case '.webm': return 'webm'
    case '.pdf': return 'pdf'
    default: return 'unknown'
  }
}

function getAllowedMimeTypes(context: UploadContext) {
  return context === 'media' ? allowedMediaMimeTypes : allowedDocumentMimeTypes
}

function getAllowedKinds(context: UploadContext) {
  return context === 'media'
    ? new Set<FileKind>(['jpeg', 'png', 'webp', 'mp4', 'webm'])
    : new Set<FileKind>(['jpeg', 'png', 'webp', 'pdf'])
}

export function validateUploadedFile(file: Express.Multer.File, context: UploadContext) {
  if (!file.buffer || file.buffer.length === 0) {
    throw new HttpError(400, 'Upload payload is empty.')
  }

  const extension = path.extname(file.originalname ?? '').toLowerCase()
  if (blockedExtensions.has(extension)) {
    throw new HttpError(400, `Blocked file extension: ${extension}`)
  }

  const allowedMimeTypes = getAllowedMimeTypes(context)
  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new HttpError(400, `Unsupported file type: ${file.mimetype}`)
  }

  const signatureKind = detectFileKind(file.buffer)
  if (['zip', 'rar', 'seven_zip', 'exe', 'gzip', 'tar'].includes(signatureKind)) {
    throw new HttpError(400, 'Blocked archive or executable upload detected.')
  }

  const mimeKind = expectedKindFromMime(file.mimetype)
  const extensionKind = expectedKindFromExtension(extension)
  const allowedKinds = getAllowedKinds(context)

  if (!allowedKinds.has(signatureKind)) {
    throw new HttpError(400, 'Unsupported or unknown file signature.')
  }

  if (mimeKind === 'unknown' || extensionKind === 'unknown') {
    throw new HttpError(400, 'Unknown or mismatched upload extension.')
  }

  if (mimeKind !== signatureKind || extensionKind !== signatureKind) {
    throw new HttpError(400, 'Upload validation failed because file extension, MIME type, and signature do not match.')
  }

  if (signatureKind !== 'mp4' && signatureKind !== 'webm' && file.size > 10 * 1024 * 1024) {
    throw new HttpError(400, 'Images and image documents must be 10MB or smaller.')
  }

  if ((signatureKind === 'mp4' || signatureKind === 'webm') && file.size > 100 * 1024 * 1024) {
    throw new HttpError(400, 'Videos must be 100MB or smaller.')
  }

  return {
    extension,
    signatureKind,
  }
}

function ensureUploadDirectory(segment: string) {
  const directory = path.resolve(runtimeProcess.cwd(), 'uploads', 'locations', segment)
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

export function saveUploadedFile(file: Express.Multer.File, segment: 'media' | 'documents') {
  const extension = path.extname(file.originalname ?? '').toLowerCase()
  const storedName = `${randomUUID()}${extension}`
  const uploadDirectory = ensureUploadDirectory(segment)
  const absolutePath = path.join(uploadDirectory, storedName)
  const buffer = file.buffer
  if (!buffer) {
    throw new HttpError(400, 'Uploaded file buffer is unavailable.')
  }
  fs.writeFileSync(absolutePath, buffer)

  const storagePath = `locations/${segment}/${storedName}`.replace(/\\/g, '/')
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

function readUInt16(buffer: Uint8Array, offset: number, littleEndian: boolean) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  return view.getUint16(offset, littleEndian)
}

function readUInt32(buffer: Uint8Array, offset: number, littleEndian: boolean) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  return view.getUint32(offset, littleEndian)
}

function readRational(buffer: Uint8Array, offset: number, littleEndian: boolean) {
  const numerator = readUInt32(buffer, offset, littleEndian)
  const denominator = readUInt32(buffer, offset + 4, littleEndian)
  return denominator === 0 ? 0 : numerator / denominator
}

function parseGpsCoordinate(values: number[], ref: string) {
  if (values.length < 3) return null
  const decimal = values[0] + (values[1] / 60) + (values[2] / 3600)
  return (ref === 'S' || ref === 'W') ? -decimal : decimal
}

function parseExifGpsFromJpeg(buffer: Uint8Array) {
  if (!bytesEqual(buffer, 0, [0xff, 0xd8])) return null

  let offset = 2
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) break
    const marker = buffer[offset + 1]
    const size = (buffer[offset + 2] << 8) + buffer[offset + 3]
    if (marker === 0xe1 && ascii(buffer, offset + 4, 4) === 'Exif') {
      const tiffOffset = offset + 10
      const endianMark = ascii(buffer, tiffOffset, 2)
      const littleEndian = endianMark === 'II'
      const firstIfdOffset = readUInt32(buffer, tiffOffset + 4, littleEndian)
      const exifBase = tiffOffset
      const ifdOffset = exifBase + firstIfdOffset
      const entryCount = readUInt16(buffer, ifdOffset, littleEndian)

      let gpsPointer = 0
      for (let index = 0; index < entryCount; index += 1) {
        const entryOffset = ifdOffset + 2 + (index * 12)
        const tag = readUInt16(buffer, entryOffset, littleEndian)
        if (tag === 0x8825) {
          gpsPointer = readUInt32(buffer, entryOffset + 8, littleEndian)
          break
        }
      }

      if (!gpsPointer) return null

      const gpsOffset = exifBase + gpsPointer
      const gpsEntries = readUInt16(buffer, gpsOffset, littleEndian)
      let latRef = 'N'
      let lonRef = 'E'
      let latValues: number[] = []
      let lonValues: number[] = []

      for (let index = 0; index < gpsEntries; index += 1) {
        const entryOffset = gpsOffset + 2 + (index * 12)
        const tag = readUInt16(buffer, entryOffset, littleEndian)
        const valueCount = readUInt32(buffer, entryOffset + 4, littleEndian)
        const valueOffset = readUInt32(buffer, entryOffset + 8, littleEndian)
        const absoluteValueOffset = exifBase + valueOffset

        if (tag === 0x0001) {
          latRef = ascii(buffer, entryOffset + 8, 1) || 'N'
        } else if (tag === 0x0002 && valueCount >= 3) {
          latValues = [
            readRational(buffer, absoluteValueOffset, littleEndian),
            readRational(buffer, absoluteValueOffset + 8, littleEndian),
            readRational(buffer, absoluteValueOffset + 16, littleEndian),
          ]
        } else if (tag === 0x0003) {
          lonRef = ascii(buffer, entryOffset + 8, 1) || 'E'
        } else if (tag === 0x0004 && valueCount >= 3) {
          lonValues = [
            readRational(buffer, absoluteValueOffset, littleEndian),
            readRational(buffer, absoluteValueOffset + 8, littleEndian),
            readRational(buffer, absoluteValueOffset + 16, littleEndian),
          ]
        }
      }

      const latitude = parseGpsCoordinate(latValues, latRef)
      const longitude = parseGpsCoordinate(lonValues, lonRef)
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        return { latitude, longitude }
      }
      return null
    }
    offset += 2 + size
  }

  return null
}

export function extractGeoCoordinates(file: Express.Multer.File) {
  const extension = path.extname(file.originalname ?? '').toLowerCase()
  if ((extension === '.jpg' || extension === '.jpeg') && file.buffer) {
    return parseExifGpsFromJpeg(file.buffer)
  }
  return null
}
