import type { ApprovalLedgerRow, ProjectMetaRow, ProjectSettingsRow, ReportsBundle } from './reportService'

const byteBuffer = globalThis.Buffer as unknown as {
  from(input: string | ArrayBuffer | ArrayBufferView, encoding?: string): any
  alloc(size: number): any
  concat(list: any[]): any
}

export interface FinancialWorkbookInput {
  bundle: ReportsBundle
  projectName: string
  generatedAt: string
  generatedBy?: string | null
  projectMeta: ProjectMetaRow
  projectSettings: ProjectSettingsRow
  approvalLedger: ApprovalLedgerRow[]
}

interface FinancialConfig {
  contingencyPct: number
  contingencyAmount: number
  reserveAmount: number
  emergencyAllocation: number
  warningThresholdPct: number
  criticalThresholdPct: number
  budgetVersion: string
}

interface SheetCell {
  value: string | number | boolean | null
  style?: number
}

interface WorkbookSheet {
  name: string
  rows: SheetCell[][]
  merges?: string[]
  freeze?: { rows?: number; cols?: number }
  autoFilter?: string
  widths?: number[]
}

const STYLE = {
  title: 1,
  subtitle: 2,
  section: 3,
  tableHeader: 4,
  label: 5,
  amount: 6,
  percent: 7,
  green: 8,
  yellow: 9,
  red: 10,
  text: 11,
  muted: 11,
} as const

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function toMoney(value: number) {
  return Number(value.toFixed(2))
}

function normalizeKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeSheetName(name: string) {
  const safe = name.replace(/[\[\]:*?/\\]/g, ' ').trim()
  return (safe.slice(0, 31) || 'Sheet').replace(/\s+/g, ' ')
}

function colName(index: number) {
  let current = index + 1
  let output = ''

  while (current > 0) {
    const remainder = (current - 1) % 26
    output = String.fromCharCode(65 + remainder) + output
    current = Math.floor((current - 1) / 26)
  }

  return output
}

function findDeepValue(source: Record<string, unknown> | null, aliases: string[]) {
  if (!source) {
    return undefined
  }

  const wanted = new Set(aliases.map(normalizeKey))
  const queue: unknown[] = [source]
  const visited = new Set<object>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object' || visited.has(current as object)) {
      continue
    }

    visited.add(current as object)

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (wanted.has(normalizeKey(key))) {
        return value
      }

      if (value && typeof value === 'object') {
        queue.push(value)
      }
    }
  }

  return undefined
}

function readFinancialConfig(projectSettings: ProjectSettingsRow, projectBudget: number): FinancialConfig {
  const rawConfig = projectSettings.config ?? {}
  const rawThresholds = projectSettings.alert_thresholds ?? {}

  const contingencyRaw = findDeepValue(rawConfig, [
    'contingencyPct',
    'contingencyPercent',
    'contingencyPercentage',
    'contingencyRate',
    'contingency',
  ])
  const reserveRaw = findDeepValue(rawConfig, [
    'reserveBudget',
    'reserveAmount',
    'reserveAllocation',
    'reserve',
  ])
  const emergencyRaw = findDeepValue(rawConfig, [
    'emergencyAllocation',
    'emergencyBudget',
    'emergencyReserve',
  ])

  const warningThresholdRaw = findDeepValue(rawThresholds, [
    'budgetWarningPct',
    'budgetWarningPercent',
    'budgetWarningPercentage',
  ])
  const criticalThresholdRaw = findDeepValue(rawThresholds, [
    'budgetCriticalPct',
    'budgetCriticalPercent',
    'budgetCriticalPercentage',
  ])
  const budgetVersionRaw = findDeepValue(rawConfig, [
    'budgetVersion',
    'budgetSheetVersion',
    'version',
  ])

  const contingencyPct = Math.max(0, Math.min(100, asNumber(contingencyRaw) <= 1 ? asNumber(contingencyRaw) * 100 : asNumber(contingencyRaw)))
  const contingencyAmount = toMoney(
    findDeepValue(rawConfig, ['contingencyAmount', 'contingencyBudget']) != null
      ? asNumber(findDeepValue(rawConfig, ['contingencyAmount', 'contingencyBudget']))
      : projectBudget * (contingencyPct / 100),
  )

  return {
    contingencyPct: toMoney(contingencyPct),
    contingencyAmount,
    reserveAmount: toMoney(asNumber(reserveRaw)),
    emergencyAllocation: toMoney(asNumber(emergencyRaw)),
    warningThresholdPct: Math.max(0, Math.min(100, asNumber(warningThresholdRaw, 85) || 85)),
    criticalThresholdPct: Math.max(0, Math.min(100, asNumber(criticalThresholdRaw, 100) || 100)),
    budgetVersion: String(budgetVersionRaw ?? 'v1').trim() || 'v1',
  }
}

function departmentLabel(department: string) {
  switch (department) {
    case 'transport':
      return 'Transport'
    case 'crew':
      return 'Crew & Wages'
    case 'camera':
      return 'Camera'
    case 'art':
      return 'Art Department'
    case 'wardrobe':
      return 'Costume'
    case 'post':
      return 'Post Production'
    case 'production':
      return 'Production'
    default:
      return department
  }
}

function statusLabel(status: 'green' | 'yellow' | 'red') {
  if (status === 'red') {
    return 'Critical'
  }

  if (status === 'yellow') {
    return 'Warning'
  }

  return 'Healthy'
}

function statusStyle(status: 'green' | 'yellow' | 'red') {
  if (status === 'red') {
    return STYLE.red
  }

  if (status === 'yellow') {
    return STYLE.yellow
  }

  return STYLE.green
}

function resolveUtilization(spent: number, budget: number) {
  if (budget <= 0) {
    return spent > 0 ? 1 : 0
  }

  return spent / budget
}

function buildCategoryRows(bundle: ReportsBundle) {
  return bundle.departments.map(row => ({
    category: departmentLabel(row.department),
    estimated: row.budget,
    actual: row.spent,
    remaining: toMoney(row.budget - row.spent),
    variance: row.variance,
    utilization: resolveUtilization(row.spent, row.budget),
    status: row.status,
  }))
}

function buildApprovalLedgerRows(approvalLedger: ApprovalLedgerRow[]) {
  return approvalLedger.map(row => {
    const status = (row.status ?? 'pending').toLowerCase()
    const submittedAt = row.submitted_at ?? row.created_at
    const resolvedAt = row.approved_at ?? row.rejected_at ?? ''
    const sourceModule = typeof row.metadata?.sourceModule === 'string'
      ? row.metadata.sourceModule
      : typeof row.metadata?.source_module === 'string'
        ? row.metadata.source_module
        : ''

    return [
      { value: row.request_title ?? row.id, style: STYLE.text },
      { value: departmentLabel(row.department ?? 'production'), style: STYLE.text },
      { value: row.type ?? 'financial', style: STYLE.text },
      { value: toMoney(asNumber(row.amount)), style: STYLE.amount },
      { value: status.charAt(0).toUpperCase() + status.slice(1), style: statusStyle(
        status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'yellow',
      ) },
      { value: submittedAt, style: STYLE.text },
      { value: resolvedAt, style: STYLE.text },
      { value: sourceModule || 'Operational module', style: STYLE.muted },
    ] satisfies SheetCell[]
  })
}

function cleanText(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value.trim() || fallback
  }

  if (value === null || value === undefined) {
    return fallback
  }

  return String(value)
}

function extractMetadataField(source: Record<string, unknown> | null, aliases: string[], fallback = '') {
  const value = findDeepValue(source, aliases)
  return cleanText(value, fallback)
}

function resolveDepartmentKey(value: string | null | undefined) {
  return normalizeKey(value ?? 'production')
}

function resolvePaymentStatus(status: string | null | undefined) {
  const normalized = (status ?? 'pending').toLowerCase()
  if (normalized === 'paid') {
    return 'Paid'
  }
  if (normalized === 'approved' || normalized === 'released') {
    return 'Approved'
  }
  if (normalized === 'rejected') {
    return 'Rejected'
  }
  return 'Pending'
}

function resolveStatusAmount(row: ApprovalLedgerRow, statusList: string[]) {
  const normalized = (row.status ?? 'pending').toLowerCase()
  return statusList.includes(normalized) ? toMoney(asNumber(row.amount)) : 0
}

function buildBudgetRegisterRow(
  bundle: ReportsBundle,
  projectMeta: ProjectMetaRow,
  config: FinancialConfig,
  generatedAt: string,
  generatedBy: string | null | undefined,
  department: string,
  row: ApprovalLedgerRow | null,
  index: number,
  departmentTotals: { budget: number; actual: number; approved: number; pending: number; paid: number; overtime: number },
  kind: 'summary' | 'detail' | 'subtotal',
) {
  const producer = cleanText(findDeepValue(projectMeta as unknown as Record<string, unknown>, ['producer_name', 'producer']), '')
  const projectCurrency = cleanText(projectMeta.currency_code, 'INR')
  const departmentLabelValue = departmentLabel(department)
  const departmentBudget = toMoney(departmentTotals.budget)
  const departmentActual = toMoney(departmentTotals.actual)
  const departmentCommitted = toMoney(departmentTotals.approved + departmentTotals.pending)
  const departmentEfc = toMoney(departmentActual + departmentTotals.pending + departmentTotals.overtime)
  const departmentVariance = toMoney(departmentBudget - departmentEfc)
  const departmentRemaining = toMoney(Math.max(departmentBudget - departmentActual, 0))
  const departmentBalance = toMoney(Math.max(departmentBudget - departmentCommitted, 0))
  const sourceModule = row ? extractMetadataField(row.metadata, ['sourceModule', 'source_module', 'module', 'referenceModule', 'reference_module'], 'Operational module') : ''
  const vendor = row ? extractMetadataField(row.metadata, ['vendorName', 'vendor_name', 'vendor', 'supplierName', 'supplier_name'], '') : ''
  const location = row ? extractMetadataField(row.metadata, ['locationName', 'location_name', 'location', 'siteName', 'site_name'], '') : ''
  const notes = row ? extractMetadataField(row.metadata, ['notes', 'note', 'comment', 'description'], row.request_title ?? '') : ''
  const attachmentFile = row ? extractMetadataField(row.metadata, ['attachmentName', 'attachment_name', 'fileName', 'file_name', 'filename'], '') : ''
  const attachmentReference = row ? extractMetadataField(row.metadata, ['attachmentUrl', 'attachment_url', 'downloadUrl', 'download_url', 'referenceUrl', 'reference_url'], '') : ''
  const quantity = row ? asNumber(findDeepValue(row.metadata, ['quantity', 'qty'])) : 0
  const unit = row ? extractMetadataField(row.metadata, ['unit', 'measureUnit', 'measure_unit'], '') : ''
  const unitRate = row ? asNumber(findDeepValue(row.metadata, ['unitRate', 'unit_rate', 'rate'])) : 0
  const multiplier = row ? asNumber(findDeepValue(row.metadata, ['multiplier', 'factor'])) : 0
  const overtime = row ? asNumber(findDeepValue(row.metadata, ['overtime', 'otHours', 'ot_hours'])) : 0
  const days = row ? asNumber(findDeepValue(row.metadata, ['days', 'dayCount', 'day_count'])) : 0
  const shootDays = row ? asNumber(findDeepValue(row.metadata, ['shootDays', 'shoot_days'])) : 0
  const crewCount = row ? asNumber(findDeepValue(row.metadata, ['crewCount', 'crew_count', 'headcount'])) : 0
  const approvedAmount = row ? resolveStatusAmount(row, ['approved', 'paid', 'released']) : 0
  const pendingAmount = row ? resolveStatusAmount(row, ['pending', 'submitted', 'queued']) : 0
  const paidAmount = row ? resolveStatusAmount(row, ['paid']) : 0
  const committedCost = row ? toMoney(approvedAmount + pendingAmount) : departmentCommitted
  const actualCost = row ? toMoney(approvedAmount + paidAmount) : departmentActual
  const estimatedFinalCost = row
    ? toMoney(actualCost + pendingAmount + (overtime ? overtime : 0))
    : departmentEfc
  const variance = row
    ? toMoney(departmentBudget - estimatedFinalCost)
    : departmentVariance
  const remainingBudget = row
    ? toMoney(Math.max(departmentBudget - actualCost, 0))
    : departmentRemaining
  const balance = row
    ? toMoney(Math.max(departmentBudget - committedCost, 0))
    : departmentBalance
  const paymentStatus = kind === 'summary'
    ? 'Summary'
    : kind === 'subtotal'
      ? 'Subtotal'
      : resolvePaymentStatus(row?.status ?? null)
  const accountNumber = kind === 'summary'
    ? `${departmentLabelValue.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-SUMMARY`
    : kind === 'subtotal'
      ? `${departmentLabelValue.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-TOTAL`
      : `${departmentLabelValue.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${String(index + 1).padStart(3, '0')}`

  return [
    { value: accountNumber, style: kind === 'subtotal' ? STYLE.label : STYLE.text },
    { value: kind === 'summary' ? departmentLabelValue : row?.type ?? departmentLabelValue, style: kind === 'subtotal' ? STYLE.label : STYLE.text },
    { value: kind === 'detail' ? sourceModule : kind === 'summary' ? 'Department Summary' : 'Subtotal', style: STYLE.text },
    { value: kind === 'detail' ? cleanText(row?.request_title ?? '', `${departmentLabelValue} line item`) : kind === 'summary' ? 'Department budget overview' : 'Department subtotal', style: STYLE.text },
    { value: departmentLabelValue, style: STYLE.text },
    { value: departmentBudget, style: STYLE.amount },
    { value: actualCost, style: STYLE.amount },
    { value: committedCost, style: STYLE.amount },
    { value: estimatedFinalCost, style: STYLE.amount },
    { value: variance, style: STYLE.amount },
    { value: remainingBudget, style: STYLE.amount },
    { value: quantity || '', style: STYLE.text },
    { value: unit, style: STYLE.text },
    { value: unitRate || '', style: STYLE.amount },
    { value: multiplier || '', style: STYLE.percent },
    { value: overtime || '', style: STYLE.amount },
    { value: days || '', style: STYLE.text },
    { value: shootDays || '', style: STYLE.text },
    { value: crewCount || '', style: STYLE.text },
    { value: vendor, style: STYLE.text },
    { value: location, style: STYLE.text },
    { value: notes, style: STYLE.muted },
    { value: approvedAmount, style: STYLE.amount },
    { value: pendingAmount, style: STYLE.amount },
    { value: paidAmount, style: STYLE.amount },
    { value: balance, style: STYLE.amount },
    { value: paymentStatus, style: kind === 'summary' ? STYLE.section : kind === 'subtotal' ? STYLE.label : STYLE.text },
    { value: projectMeta.name, style: STYLE.text },
    { value: cleanText(projectMeta.production_house), style: STYLE.text },
    { value: cleanText(projectMeta.client_name), style: STYLE.text },
    { value: cleanText(producer || generatedBy), style: STYLE.text },
    { value: projectCurrency, style: STYLE.text },
    { value: config.budgetVersion, style: STYLE.text },
    { value: new Date(generatedAt).toLocaleDateString('en-IN'), style: STYLE.text },
    { value: cleanText(generatedBy), style: STYLE.text },
    { value: attachmentFile, style: STYLE.text },
    { value: attachmentReference, style: STYLE.text },
  ] satisfies SheetCell[]
}

function buildBudgetRegisterSheet(
  bundle: ReportsBundle,
  projectMeta: ProjectMetaRow,
  config: FinancialConfig,
  approvalLedger: ApprovalLedgerRow[],
  generatedAt: string,
  generatedBy: string | null | undefined,
) {
  const ledgerByDepartment = new Map<string, ApprovalLedgerRow[]>()
  for (const row of approvalLedger) {
    const departmentKey = resolveDepartmentKey(row.department)
    const current = ledgerByDepartment.get(departmentKey) ?? []
    current.push(row)
    ledgerByDepartment.set(departmentKey, current)
  }

  const rows: SheetCell[][] = [
    [{ value: 'Budget Register', style: STYLE.title }],
    [{ value: `Project: ${bundle.projectName}`, style: STYLE.subtitle }],
    [{ value: `Production House: ${cleanText(projectMeta.production_house)} | Client: ${cleanText(projectMeta.client_name)} | Currency: ${cleanText(projectMeta.currency_code, 'INR')} | Generated By: ${cleanText(generatedBy, 'ProdSync')}`, style: STYLE.subtitle }],
    [],
    [
      { value: 'Account Number', style: STYLE.tableHeader },
      { value: 'Category', style: STYLE.tableHeader },
      { value: 'Sub Category', style: STYLE.tableHeader },
      { value: 'Description', style: STYLE.tableHeader },
      { value: 'Department', style: STYLE.tableHeader },
      { value: 'Budget', style: STYLE.tableHeader },
      { value: 'Actual Cost', style: STYLE.tableHeader },
      { value: 'Committed Cost', style: STYLE.tableHeader },
      { value: 'Estimated Final Cost (EFC)', style: STYLE.tableHeader },
      { value: 'Variance', style: STYLE.tableHeader },
      { value: 'Remaining Budget', style: STYLE.tableHeader },
      { value: 'Quantity', style: STYLE.tableHeader },
      { value: 'Unit', style: STYLE.tableHeader },
      { value: 'Unit Rate', style: STYLE.tableHeader },
      { value: 'Multiplier', style: STYLE.tableHeader },
      { value: 'Overtime', style: STYLE.tableHeader },
      { value: 'Days', style: STYLE.tableHeader },
      { value: 'Shoot Days', style: STYLE.tableHeader },
      { value: 'Crew Count', style: STYLE.tableHeader },
      { value: 'Vendor', style: STYLE.tableHeader },
      { value: 'Location', style: STYLE.tableHeader },
      { value: 'Notes', style: STYLE.tableHeader },
      { value: 'Approved Amount', style: STYLE.tableHeader },
      { value: 'Pending Amount', style: STYLE.tableHeader },
      { value: 'Paid Amount', style: STYLE.tableHeader },
      { value: 'Balance', style: STYLE.tableHeader },
      { value: 'Payment Status', style: STYLE.tableHeader },
      { value: 'Project Name', style: STYLE.tableHeader },
      { value: 'Production House', style: STYLE.tableHeader },
      { value: 'Client', style: STYLE.tableHeader },
      { value: 'Producer', style: STYLE.tableHeader },
      { value: 'Currency', style: STYLE.tableHeader },
      { value: 'Budget Version', style: STYLE.tableHeader },
      { value: 'Export Date', style: STYLE.tableHeader },
      { value: 'Generated By', style: STYLE.tableHeader },
      { value: 'Attachment File', style: STYLE.tableHeader },
      { value: 'Attachment Reference', style: STYLE.tableHeader },
    ],
  ]

  const departmentOrder = bundle.departments.map(row => row.department)

  departmentOrder.forEach((department, index) => {
    const departmentRows = ledgerByDepartment.get(resolveDepartmentKey(department)) ?? []
    const departmentBudget = toMoney(bundle.departments.find(row => row.department === department)?.budget ?? 0)
    const departmentActual = toMoney(bundle.departments.find(row => row.department === department)?.spent ?? 0)
    const approvedAmount = toMoney(departmentRows.reduce((sum, row) => sum + resolveStatusAmount(row, ['approved', 'paid', 'released']), 0))
    const pendingAmount = toMoney(departmentRows.reduce((sum, row) => sum + resolveStatusAmount(row, ['pending', 'submitted', 'queued']), 0))
    const paidAmount = toMoney(departmentRows.reduce((sum, row) => sum + resolveStatusAmount(row, ['paid']), 0))
    const overtime = toMoney(departmentRows.reduce((sum, row) => sum + asNumber(findDeepValue(row.metadata, ['overtime', 'otHours', 'ot_hours'])), 0))
    const totals = {
      budget: departmentBudget,
      actual: departmentActual,
      approved: approvedAmount,
      pending: pendingAmount,
      paid: paidAmount,
      overtime,
    }

    rows.push(buildBudgetRegisterRow(bundle, projectMeta, config, generatedAt, generatedBy, department, null, index, totals, 'summary'))

    departmentRows.forEach((row, rowIndex) => {
      rows.push(buildBudgetRegisterRow(bundle, projectMeta, config, generatedAt, generatedBy, department, row, rowIndex, totals, 'detail'))
    })

    rows.push(buildBudgetRegisterRow(bundle, projectMeta, config, generatedAt, generatedBy, department, null, index, totals, 'subtotal'))
    if (index < departmentOrder.length - 1) {
      rows.push([])
    }
  })

  return {
    name: 'Budget Register',
    rows,
    freeze: { rows: 5, cols: 0 },
    autoFilter: `A5:AK${Math.max(5, rows.length)}`,
    widths: [
      18, 20, 18, 28, 18, 14, 14, 16, 18, 14, 16, 12, 10, 12, 11, 10, 10, 12, 12, 18, 18, 22, 14, 14, 12, 14, 14, 20, 18, 18, 18, 12, 14, 14, 18, 18, 18,
    ],
  } satisfies WorkbookSheet
}

function cellXml(ref: string, cell: SheetCell) {
  const style = cell.style != null ? ` s="${cell.style}"` : ''

  if (cell.value === null || cell.value === undefined) {
    return ''
  }

  if (typeof cell.value === 'number') {
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`
  }

  if (typeof cell.value === 'boolean') {
    return `<c r="${ref}" t="b"${style}><v>${cell.value ? 1 : 0}</v></c>`
  }

  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`
}

function buildSheetXml(sheet: WorkbookSheet) {
  const rowCount = sheet.rows.length
  const columnCount = Math.max(1, ...sheet.rows.map(row => row.length))
  const dimension = `A1:${colName(columnCount - 1)}${Math.max(rowCount, 1)}`

  const rowsXml = sheet.rows.map((row, rowIndex) => {
    const cells = row
      .map((cell, colIndex) => {
        if (!cell || cell.value === null || cell.value === undefined) {
          return ''
        }

        return cellXml(`${colName(colIndex)}${rowIndex + 1}`, cell)
      })
      .filter(Boolean)
      .join('')

    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')

  const colsXml = sheet.widths && sheet.widths.length > 0
    ? `<cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : ''

  const mergesXml = sheet.merges && sheet.merges.length > 0
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : ''

  const freezeXml = sheet.freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane${sheet.freeze.rows ? ` ySplit="${sheet.freeze.rows}" topLeftCell="${colName(sheet.freeze.cols ?? 0)}${(sheet.freeze.rows ?? 0) + 1}"` : ''}${sheet.freeze.cols ? ` xSplit="${sheet.freeze.cols}" topLeftCell="${colName(sheet.freeze.cols)}1"` : ''} activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'

  const autoFilterXml = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimension}"/>
  ${freezeXml}
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
  ${mergesXml}
  ${autoFilterXml}
  <pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
</worksheet>`
}

function buildWorkbookXml(sheets: WorkbookSheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView activeTab="0"/>
  </bookViews>
  <sheets>
    ${sheets.map((sheet, index) => `<sheet name="${escapeXml(sanitizeSheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}
  </sheets>
  <calcPr calcId="171027" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`
}

function buildWorkbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_unused, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function buildContentTypesXml(sheetCount: number) {
  const overrides = [
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ...Array.from({ length: sheetCount }, (_unused, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
  ].join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides}
</Types>`
}

function buildDocPropsCoreXml(projectName: string, generatedAt: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(`${projectName} Financial Engine`)}</dc:title>
  <dc:subject>Budget Workbook</dc:subject>
  <dc:creator>ProdSync</dc:creator>
  <cp:keywords>budget,finance,prodsync,project</cp:keywords>
  <dc:description>Automatically generated financial engine workbook.</dc:description>
  <cp:lastModifiedBy>ProdSync</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date(generatedAt).toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date(generatedAt).toISOString()}</dcterms:modified>
</cp:coreProperties>`
}

function buildDocPropsAppXml(sheetNames: string[]) {
  const titles = sheetNames.map(name => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ProdSync</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${sheetNames.length}" baseType="lpstr">
      ${titles}
    </vt:vector>
  </TitlesOfParts>
  <Company>ProdSync</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="₹#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
  </numFmts>
  <fonts count="7">
    <font><sz val="11"/><color rgb="FF1F2937"/><name val="Aptos"/></font>
    <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
    <font><italic/><sz val="10"/><color rgb="FF6B7280"/><name val="Aptos"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
    <font><b/><sz val="10"/><color rgb="FF111827"/><name val="Aptos"/></font>
    <font><b/><sz val="12"/><color rgb="FF111827"/><name val="Aptos"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF97316"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="6" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="6" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`
}

interface ZipEntry {
  name: string
  data: any
  crc32: number
  offset: number
}

function crc32(buffer: any) {
  let crc = 0xffffffff

  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index]
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear())
  const dosTime = ((date.getHours() & 0x1f) << 11)
    | ((date.getMinutes() & 0x3f) << 5)
    | Math.floor(date.getSeconds() / 2)
  const dosDate = (((year - 1980) & 0x7f) << 9)
    | (((date.getMonth() + 1) & 0x0f) << 5)
    | (date.getDate() & 0x1f)

  return { dosTime, dosDate }
}

function u16(value: number) {
  const buffer = byteBuffer.alloc(2)
  buffer.writeUInt16LE(value & 0xffff, 0)
  return buffer
}

function u32(value: number) {
  const buffer = byteBuffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0, 0)
  return buffer
}

function createZip(entries: { name: string; data: Buffer }[]) {
  const zipEntries: ZipEntry[] = []
  const localParts: any[] = []
  let offset = 0
  const { dosTime, dosDate } = dosDateTime()

  for (const entry of entries) {
    const nameBuffer = byteBuffer.from(entry.name, 'utf8')
    const dataBuffer = entry.data
    const crc = crc32(dataBuffer)
    const localHeader = byteBuffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(dataBuffer.length),
      u32(dataBuffer.length),
      u16(nameBuffer.length),
      u16(0),
      nameBuffer,
      dataBuffer,
    ])

    localParts.push(localHeader)
    zipEntries.push({
      name: entry.name,
      data: dataBuffer,
      crc32: crc,
      offset,
    })
    offset += localHeader.length
  }

  const centralParts: any[] = []
  let centralSize = 0

  for (const entry of zipEntries) {
    const nameBuffer = byteBuffer.from(entry.name, 'utf8')
    const centralHeader = byteBuffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(entry.crc32),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(nameBuffer.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.offset),
      nameBuffer,
    ])

    centralParts.push(centralHeader)
    centralSize += centralHeader.length
  }

  const endOfCentralDirectory = byteBuffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(zipEntries.length),
    u16(zipEntries.length),
    u32(centralSize),
    u32(offset),
    u16(0),
  ])

  return Buffer.concat([...localParts, ...centralParts, endOfCentralDirectory])
}

function buildSummarySheet(
  bundle: ReportsBundle,
  config: FinancialConfig,
  approvalLedger: ApprovalLedgerRow[],
  projectMeta: ProjectMetaRow,
  generatedBy: string | null | undefined,
) {
  const producer = cleanText(findDeepValue(projectMeta as unknown as Record<string, unknown>, ['producer_name', 'producer']), '')
  const budget = toMoney(bundle.summary.budget)
  const actual = toMoney(bundle.summary.totalSpend)
  const pending = toMoney(bundle.summary.pendingApprovals)
  const overtime = toMoney(bundle.summary.overtimeLiability)
  const remaining = toMoney(Math.max(budget - actual, 0))
  const available = toMoney(Math.max(budget - (actual + pending + overtime), 0))
  const utilization = bundle.summary.budget > 0 ? actual / budget : 0
  const departmentSectionRow = 12
  const departmentHeaderRow = 13
  const departmentEndRow = departmentHeaderRow + bundle.departments.length
  const ledgerSectionRow = departmentEndRow + 2
  const ledgerHeaderRow = ledgerSectionRow + 1
  const status = utilization >= config.criticalThresholdPct / 100
    ? 'red'
    : utilization >= config.warningThresholdPct / 100
      ? 'yellow'
      : 'green'

  const rows: SheetCell[][] = [
    [{ value: 'ProdSync Financial Engine', style: STYLE.title }],
    [{ value: `Project: ${bundle.projectName} | Production House: ${cleanText(projectMeta.production_house, 'N/A')} | Generated: ${new Date(bundle.generatedAt).toLocaleString('en-IN')}`, style: STYLE.subtitle }],
    [{ value: `Client: ${cleanText(projectMeta.client_name, 'N/A')} | Producer: ${cleanText(producer || generatedBy, 'N/A')} | Currency: ${cleanText(projectMeta.currency_code, 'INR')} | Version: ${config.budgetVersion}`, style: STYLE.subtitle }],
    [],
    [{ value: 'Estimated Project Budget', style: STYLE.section }, { value: 'Actual Spend', style: STYLE.section }, { value: 'Remaining Budget', style: STYLE.section }, { value: 'Budget Utilization', style: STYLE.section }],
    [{ value: budget, style: STYLE.amount }, { value: actual, style: STYLE.amount }, { value: remaining, style: STYLE.amount }, { value: utilization, style: STYLE.percent }],
    [{ value: 'Contingency Budget', style: STYLE.section }, { value: 'Reserve Budget', style: STYLE.section }, { value: 'Emergency Allocation', style: STYLE.section }, { value: 'Budget Health', style: STYLE.section }],
    [{ value: config.contingencyAmount, style: STYLE.amount }, { value: config.reserveAmount, style: STYLE.amount }, { value: config.emergencyAllocation, style: STYLE.amount }, { value: statusLabel(status), style: statusStyle(status) }],
    [{ value: 'Approved Pending Commitments', style: STYLE.section }, { value: 'Available After Commitments', style: STYLE.section }, { value: 'Variance vs Budget', style: STYLE.section }, { value: 'Health Thresholds', style: STYLE.section }],
    [{ value: pending + overtime, style: STYLE.amount }, { value: available, style: STYLE.amount }, { value: toMoney(actual - budget), style: STYLE.amount }, { value: `${config.warningThresholdPct.toFixed(0)}% warning / ${config.criticalThresholdPct.toFixed(0)}% critical`, style: STYLE.text }],
    [],
    [{ value: 'Department Budgets', style: STYLE.section }],
    [{ value: 'Department', style: STYLE.tableHeader }, { value: 'Estimated Budget', style: STYLE.tableHeader }, { value: 'Actual Cost', style: STYLE.tableHeader }, { value: 'Remaining Budget', style: STYLE.tableHeader }, { value: 'Utilization', style: STYLE.tableHeader }, { value: 'Variance', style: STYLE.tableHeader }, { value: 'Status', style: STYLE.tableHeader }],
    ...bundle.departments.map(row => [
      { value: departmentLabel(row.department), style: STYLE.text },
      { value: row.budget, style: STYLE.amount },
      { value: row.spent, style: STYLE.amount },
      { value: toMoney(Math.max(row.budget - row.spent, 0)), style: STYLE.amount },
      { value: resolveUtilization(row.spent, row.budget), style: STYLE.percent },
      { value: row.variance, style: STYLE.amount },
      { value: statusLabel(row.status), style: statusStyle(row.status) },
    ]),
    [],
    [{ value: 'Recent Approval Ledger', style: STYLE.section }],
    [{ value: 'Request Title', style: STYLE.tableHeader }, { value: 'Department', style: STYLE.tableHeader }, { value: 'Type', style: STYLE.tableHeader }, { value: 'Amount', style: STYLE.tableHeader }, { value: 'Status', style: STYLE.tableHeader }, { value: 'Submitted', style: STYLE.tableHeader }, { value: 'Resolved', style: STYLE.tableHeader }, { value: 'Source Module', style: STYLE.tableHeader }],
    ...buildApprovalLedgerRows(approvalLedger),
  ]

  return {
    name: 'Budget Summary',
    rows,
    merges: [
      'A1:H1',
      'A2:H2',
      'A3:H3',
      `A${departmentSectionRow}:H${departmentSectionRow}`,
      `A${ledgerSectionRow}:H${ledgerSectionRow}`,
    ],
    freeze: { rows: departmentHeaderRow, cols: 0 },
    autoFilter: `A${departmentHeaderRow}:G${departmentEndRow}`,
    widths: [24, 18, 18, 18, 14, 16, 18, 20],
  } satisfies WorkbookSheet
}

function buildDepartmentSheet(bundle: ReportsBundle) {
  const rows: SheetCell[][] = [
    [{ value: 'Department Budgets', style: STYLE.title }],
    [{ value: `Project: ${bundle.projectName}`, style: STYLE.subtitle }],
    [],
    [{ value: 'Department', style: STYLE.tableHeader }, { value: 'Estimated Budget', style: STYLE.tableHeader }, { value: 'Actual Cost', style: STYLE.tableHeader }, { value: 'Remaining Budget', style: STYLE.tableHeader }, { value: 'Utilization', style: STYLE.tableHeader }, { value: 'Variance', style: STYLE.tableHeader }, { value: 'Pending Approvals', style: STYLE.tableHeader }, { value: 'Status', style: STYLE.tableHeader }],
    ...bundle.departments.map(row => [
      { value: departmentLabel(row.department), style: STYLE.text },
      { value: row.budget, style: STYLE.amount },
      { value: row.spent, style: STYLE.amount },
      { value: toMoney(Math.max(row.budget - row.spent, 0)), style: STYLE.amount },
      { value: resolveUtilization(row.spent, row.budget), style: STYLE.percent },
      { value: row.variance, style: STYLE.amount },
      { value: row.pendingApprovals, style: STYLE.amount },
      { value: statusLabel(row.status), style: statusStyle(row.status) },
    ]),
    [{ value: 'Total', style: STYLE.label }, { value: bundle.departments.reduce((sum, row) => sum + row.budget, 0), style: STYLE.amount }, { value: bundle.departments.reduce((sum, row) => sum + row.spent, 0), style: STYLE.amount }, { value: toMoney(bundle.departments.reduce((sum, row) => sum + Math.max(row.budget - row.spent, 0), 0)), style: STYLE.amount }, { value: bundle.summary.budget > 0 ? bundle.summary.totalSpend / bundle.summary.budget : 0, style: STYLE.percent }, { value: bundle.departments.reduce((sum, row) => sum + row.variance, 0), style: STYLE.amount }, { value: bundle.departments.reduce((sum, row) => sum + row.pendingApprovals, 0), style: STYLE.amount }, { value: 'Aggregate', style: STYLE.muted }],
  ]

  return {
    name: 'Department Budgets',
    rows,
    freeze: { rows: 4, cols: 0 },
    autoFilter: `A4:H${4 + bundle.departments.length}`,
    widths: [24, 18, 18, 18, 14, 16, 18, 16],
  } satisfies WorkbookSheet
}

function buildCategorySheet(bundle: ReportsBundle) {
  const categoryRows = buildCategoryRows(bundle)

  const rows: SheetCell[][] = [
    [{ value: 'Category Totals', style: STYLE.title }],
    [{ value: `Project: ${bundle.projectName}`, style: STYLE.subtitle }],
    [],
    [{ value: 'Category', style: STYLE.tableHeader }, { value: 'Estimated Budget', style: STYLE.tableHeader }, { value: 'Actual Cost', style: STYLE.tableHeader }, { value: 'Remaining Budget', style: STYLE.tableHeader }, { value: 'Utilization', style: STYLE.tableHeader }, { value: 'Variance', style: STYLE.tableHeader }, { value: 'Status', style: STYLE.tableHeader }],
    ...categoryRows.map(row => [
      { value: row.category, style: STYLE.text },
      { value: row.estimated, style: STYLE.amount },
      { value: row.actual, style: STYLE.amount },
      { value: row.remaining, style: STYLE.amount },
      { value: row.utilization, style: STYLE.percent },
      { value: row.variance, style: STYLE.amount },
      { value: statusLabel(row.status), style: statusStyle(row.status) },
    ]),
  ]

  return {
    name: 'Category Totals',
    rows,
    freeze: { rows: 4, cols: 0 },
    autoFilter: `A4:G${4 + categoryRows.length}`,
    widths: [26, 18, 18, 18, 14, 16, 16],
  } satisfies WorkbookSheet
}

function buildApprovalsSheet(bundle: ReportsBundle, approvalLedger: ApprovalLedgerRow[]) {
  const rows: SheetCell[][] = [
    [{ value: 'Approval Ledger', style: STYLE.title }],
    [{ value: `Project: ${bundle.projectName}`, style: STYLE.subtitle }],
    [],
    [{ value: 'Request Title', style: STYLE.tableHeader }, { value: 'Department', style: STYLE.tableHeader }, { value: 'Type', style: STYLE.tableHeader }, { value: 'Amount', style: STYLE.tableHeader }, { value: 'Status', style: STYLE.tableHeader }, { value: 'Submitted', style: STYLE.tableHeader }, { value: 'Resolved', style: STYLE.tableHeader }, { value: 'Source Module', style: STYLE.tableHeader }],
    ...buildApprovalLedgerRows(approvalLedger),
  ]

  return {
    name: 'Approvals Ledger',
    rows,
    freeze: { rows: 4, cols: 0 },
    autoFilter: `A4:H${4 + approvalLedger.length}`,
    widths: [26, 18, 16, 16, 12, 20, 20, 18],
  } satisfies WorkbookSheet
}

function sheetXmlRows(sheet: WorkbookSheet) {
  const rowXml = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, colIndex) => {
      if (!cell || cell.value === null || cell.value === undefined) {
        return ''
      }

      return cellXml(`${colName(colIndex)}${rowIndex + 1}`, cell)
    }).filter(Boolean).join('')

    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')

  const rowCount = sheet.rows.length
  const colCount = Math.max(1, ...sheet.rows.map(row => row.length))
  const dimension = `A1:${colName(colCount - 1)}${Math.max(rowCount, 1)}`
  const mergesXml = sheet.merges && sheet.merges.length > 0
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : ''
  const colsXml = sheet.widths && sheet.widths.length > 0
    ? `<cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : ''

  const freezeRows = sheet.freeze?.rows ?? 0
  const freezeCols = sheet.freeze?.cols ?? 0
  const freezeXml = freezeRows > 0 || freezeCols > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane${freezeCols > 0 ? ` xSplit="${freezeCols}"` : ''}${freezeRows > 0 ? ` ySplit="${freezeRows}"` : ''} topLeftCell="${colName(freezeCols)}${freezeRows + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'

  const autoFilterXml = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimension}"/>
  ${freezeXml}
  ${colsXml}
  <sheetData>${rowXml}</sheetData>
  ${mergesXml}
  ${autoFilterXml}
  <pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
</worksheet>`
}

function buildZipEntries(input: FinancialWorkbookInput) {
  const config = readFinancialConfig(input.projectSettings, input.bundle.summary.budget)
  const sheets = [
    buildSummarySheet(input.bundle, config, input.approvalLedger, input.projectMeta, input.generatedBy),
    buildBudgetRegisterSheet(input.bundle, input.projectMeta, config, input.approvalLedger, input.generatedAt, input.generatedBy),
    buildDepartmentSheet(input.bundle),
    buildCategorySheet(input.bundle),
    buildApprovalsSheet(input.bundle, input.approvalLedger),
  ]

  const xmlSheets = sheets.map(sheet => sheetXmlRows(sheet))
  const sheetNames = sheets.map(sheet => sanitizeSheetName(sheet.name))

  return [
    { name: '[Content_Types].xml', data: byteBuffer.from(buildContentTypesXml(sheets.length), 'utf8') },
    { name: '_rels/.rels', data: byteBuffer.from(buildRootRelsXml(), 'utf8') },
    { name: 'docProps/core.xml', data: byteBuffer.from(buildDocPropsCoreXml(input.projectName, input.generatedAt), 'utf8') },
    { name: 'docProps/app.xml', data: byteBuffer.from(buildDocPropsAppXml(sheetNames), 'utf8') },
    { name: 'xl/workbook.xml', data: byteBuffer.from(buildWorkbookXml(sheets), 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: byteBuffer.from(buildWorkbookRelsXml(sheets.length), 'utf8') },
    { name: 'xl/styles.xml', data: byteBuffer.from(buildStylesXml(), 'utf8') },
    ...xmlSheets.map((xml, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: byteBuffer.from(xml, 'utf8') })),
  ]
}

export function buildBudgetWorkbook(input: FinancialWorkbookInput) {
  const workbookBuffer = createZip(buildZipEntries(input))
  const safeProjectName = input.projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project'

  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${safeProjectName}-budget-workbook.xlsx`,
    body: workbookBuffer,
  }
}
