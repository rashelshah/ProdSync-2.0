import { runtimeBuffer } from './runtime'

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function createSimplePdf(lines: string[]) {
  const bodyLines = lines.slice(0, 42).map(line => `(${escapePdfText(line)}) Tj`).join('\nT*\n')
  const content = `BT
/F1 11 Tf
50 790 Td
14 TL
${bodyLines}
ET`

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${runtimeBuffer.byteLength(content, 'utf8')} >> stream
${content}
endstream endobj`,
  ]

  const header = '%PDF-1.4\n'
  const offsets: number[] = []
  let currentOffset = runtimeBuffer.byteLength(header, 'utf8')
  let body = ''

  for (const object of objects) {
    offsets.push(currentOffset)
    body += `${object}\n`
    currentOffset += runtimeBuffer.byteLength(`${object}\n`, 'utf8')
  }

  const xrefOffset = currentOffset
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n')

  return runtimeBuffer.from(header + body + xref, 'utf8')
}
