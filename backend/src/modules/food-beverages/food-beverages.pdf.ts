import { runtimeBuffer } from '../../utils/runtime'

type PdfFont = 'F1' | 'F2'

export interface FoodBeverageInvoicePdfData {
  invoiceNumber: string
  invoiceDate: string
  projectName: string
  department: string
  mealPeriod: string
  forecastDate: string
  forecastCrewCount: string
  actualServedCount: string
  unusedPlates: string
  wastedMeals: string
  plateCost: string
  teaCoffeeExpense: string
  foodCost: string
  totalCost: string
  vendorName: string
  vendorContactNumber: string
  approvalStatus: string
  generatedBy: string
  generatedDate: string
  notes: string
  generatedTimestamp: string
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return ['-']
  }

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
      continue
    }

    if (current) {
      lines.push(current)
      current = word
      continue
    }

    lines.push(word.slice(0, maxChars))
    current = word.slice(maxChars)
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function rgb(values: [number, number, number]) {
  return `${values[0].toFixed(3)} ${values[1].toFixed(3)} ${values[2].toFixed(3)}`
}

function createPdfDocument(commands: string[]) {
  const content = commands.join('\n')
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
    `6 0 obj << /Length ${runtimeBuffer.byteLength(content, 'utf8')} >> stream
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

export function createFoodBeverageInvoicePdf(data: FoodBeverageInvoicePdfData) {
  const commands: string[] = []
  const ink: [number, number, number] = [0.137, 0.137, 0.153]
  const muted: [number, number, number] = [0.420, 0.443, 0.490]
  const accent: [number, number, number] = [0.973, 0.451, 0.090]
  const surface: [number, number, number] = [0.973, 0.976, 0.984]
  const white: [number, number, number] = [1, 1, 1]

  const addRect = (x: number, y: number, width: number, height: number, fill: [number, number, number]) => {
    commands.push(`${rgb(fill)} rg`)
    commands.push(`${x} ${y} ${width} ${height} re f`)
  }

  const addLine = (x1: number, y1: number, x2: number, y2: number, stroke: [number, number, number], width = 1) => {
    commands.push(`${width.toFixed(2)} w`)
    commands.push(`${rgb(stroke)} RG`)
    commands.push(`${x1} ${y1} m ${x2} ${y2} l S`)
  }

  const addText = (text: string, x: number, y: number, options?: { size?: number; font?: PdfFont; color?: [number, number, number] }) => {
    const font = options?.font ?? 'F1'
    const size = options?.size ?? 11
    const color = options?.color ?? ink
    commands.push('BT')
    commands.push(`${rgb(color)} rg`)
    commands.push(`/${font} ${size} Tf`)
    commands.push(`1 0 0 1 ${x} ${y} Tm`)
    commands.push(`(${escapePdfText(text)}) Tj`)
    commands.push('ET')
  }

  const addWrappedText = (
    text: string,
    x: number,
    y: number,
    maxChars: number,
    options?: { size?: number; font?: PdfFont; color?: [number, number, number]; lineHeight?: number },
  ) => {
    const lines = wrapText(text, maxChars)
    const lineHeight = options?.lineHeight ?? ((options?.size ?? 11) + 3)
    lines.forEach((line, index) => {
      addText(line, x, y - (index * lineHeight), options)
    })
    return lines.length
  }

  addRect(32, 738, 531, 76, ink)
  addRect(46, 761, 26, 26, accent)
  addText('PS', 51, 769, { font: 'F2', size: 12, color: white })
  addText('ProdSync', 84, 781, { font: 'F2', size: 22, color: white })
  addText('Professional Invoice Summary', 84, 760, { size: 10, color: [0.910, 0.914, 0.922] })
  addText(data.invoiceNumber, 384, 782, { font: 'F2', size: 15, color: white })
  addText(`Date ${data.invoiceDate}`, 384, 760, { size: 10, color: [0.910, 0.914, 0.922] })

  let y = 710

  const drawSection = (title: string, rows: Array<{ label: string; value: string }>) => {
    addText(title, 40, y, { font: 'F2', size: 12, color: accent })
    y -= 10
    addLine(40, y, 555, y, [0.898, 0.906, 0.922])
    y -= 18

    for (let index = 0; index < rows.length; index += 2) {
      const left = rows[index]
      const right = rows[index + 1] ?? null
      const leftLines = wrapText(left.value, 30).length
      const rightLines = right ? wrapText(right.value, 30).length : 1
      const cellHeight = Math.max(leftLines, rightLines) * 15 + 26

      addRect(40, y - cellHeight + 10, 247, cellHeight, surface)
      addText(left.label, 52, y, { font: 'F2', size: 9, color: muted })
      addWrappedText(left.value, 52, y - 16, 30, { size: 11, color: ink, lineHeight: 14 })

      if (right) {
        addRect(308, y - cellHeight + 10, 247, cellHeight, surface)
        addText(right.label, 320, y, { font: 'F2', size: 9, color: muted })
        addWrappedText(right.value, 320, y - 16, 30, { size: 11, color: ink, lineHeight: 14 })
      }

      y -= cellHeight + 12
    }
  }

  drawSection('Production Details', [
    { label: 'Project Name', value: data.projectName },
    { label: 'Department', value: data.department },
    { label: 'Meal Period', value: data.mealPeriod },
    { label: 'Forecast Date', value: data.forecastDate },
    { label: 'Forecast Crew Count', value: data.forecastCrewCount },
    { label: 'Actual Served Count', value: data.actualServedCount },
  ])

  drawSection('Vendor Details', [
    { label: 'Vendor Name', value: data.vendorName },
    { label: 'Vendor Contact Number', value: data.vendorContactNumber },
    { label: 'Generated By', value: data.generatedBy },
    { label: 'Generated Date', value: data.generatedDate },
  ])

  drawSection('Meal Details', [
    { label: 'Unused Plates', value: data.unusedPlates },
    { label: 'Wasted Meals', value: data.wastedMeals },
    { label: 'Approval Status', value: data.approvalStatus },
    { label: 'Invoice Date', value: data.invoiceDate },
  ])

  drawSection('Cost Breakdown', [
    { label: 'Plate Cost', value: data.plateCost },
    { label: 'Tea / Coffee Expense', value: data.teaCoffeeExpense },
    { label: 'Food Cost', value: data.foodCost },
    { label: 'Total Cost', value: data.totalCost },
  ])

  addText('Notes', 40, y, { font: 'F2', size: 12, color: accent })
  y -= 10
  addLine(40, y, 555, y, [0.898, 0.906, 0.922])
  y -= 18
  const noteLines = wrapText(data.notes, 86)
  const notesHeight = Math.max(56, noteLines.length * 14 + 20)
  addRect(40, y - notesHeight + 10, 515, notesHeight, surface)
  addWrappedText(data.notes, 52, y - 8, 86, { size: 11, color: ink, lineHeight: 14 })

  addRect(32, 24, 531, 42, ink)
  addText(`Approval Status: ${data.approvalStatus}`, 44, 42, { font: 'F2', size: 10, color: white })
  addText(`Generated ${formatDateTime(data.generatedTimestamp)}`, 318, 42, { size: 10, color: [0.910, 0.914, 0.922] })

  return createPdfDocument(commands)
}
