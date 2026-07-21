const fs = require('fs')

function readLines(path) {
  return fs.readFileSync(path, 'utf8').split(/\r?\n/)
}

function writeLines(path, lines) {
  fs.writeFileSync(path, lines.join('\r\n'))
}

function findLine(lines, needle, start = 0) {
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i] === needle) return i
  }
  throw new Error(`Could not find line: ${needle}`)
}

function replaceLine(lines, needle, replacement, start = 0) {
  const index = findLine(lines, needle, start)
  lines[index] = replacement
}

function insertAfter(lines, needle, insertLines, start = 0) {
  const index = findLine(lines, needle, start)
  lines.splice(index + 1, 0, ...insertLines)
}

function insertBefore(lines, needle, insertLines, start = 0) {
  const index = findLine(lines, needle, start)
  lines.splice(index, 0, ...insertLines)
}

const frontendPath = 'C:/Users/pande/ProdSync-2.0/prodsync-app/src/modules/projects/components/ProjectPlanningWizard.tsx'
const frontend = readLines(frontendPath)

replaceLine(frontend, 'type ExpenseItem = { id: string; item: string; qty: number; unit: string; rate: number; bufferPercent: number; notes: string; sortOrder: number; isPlanned: boolean }', 'type ExpenseItem = { id: string; item: string; qty: number; unit: string; rate: number; dailyWagePerDay: number; bufferPercent: number; notes: string; sortOrder: number; isPlanned: boolean }')
replaceLine(frontend, 'const itemBaseTotal = (item: ExpenseItem) => numberValue(item.qty) * numberValue(item.rate)', 'const itemBaseTotal = (item: ExpenseItem) => numberValue(item.qty) * (numberValue(item.rate) + numberValue(item.dailyWagePerDay))')

const newExpenseStart = findLine(frontend, "function newExpenseItem(label = 'Line Item', sortOrder = 0): ExpenseItem {")
insertAfter(frontend, '    rate: 0,', ['    dailyWagePerDay: 0,'], newExpenseStart)

const normalizeStart = findLine(frontend, 'function normalizeExpenseDepartments(payload: Record<string, unknown> | undefined | null): ExpenseDepartment[] {')
insertAfter(frontend, '          rate: numberValue(item.rate),', ['          dailyWagePerDay: numberValue(item.dailyWagePerDay ?? item.dailyWage ?? 0),'], normalizeStart)

const legacyStart = findLine(frontend, '  if (payload && Array.isArray(payload.categories) && payload.categories.length > 0) {')
insertAfter(frontend, '        rate: numberValue(row.rate ?? row.estimatedBudget ?? 0),', ['        dailyWagePerDay: numberValue(row.dailyWagePerDay ?? row.dailyWage ?? 0),'], legacyStart)

const flattenStart = findLine(frontend, 'function flattenExpenseDepartments(departments: ExpenseDepartment[]) {')
insertAfter(frontend, '      rate: item.rate,', ['      dailyWagePerDay: item.dailyWagePerDay,'], flattenStart)

const planningDecimalInput = `function PlanningDecimalInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(() => String(value))

  useEffect(() => {
    setDraft(current => {
      if (current.trim() === '' && value === 0) {
        return ''
      }

      return String(value)
    })
  }, [value])

  return (
    <input
      className="project-modal-control"
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      onChange={event => {
        const nextValue = event.target.value
        setDraft(nextValue)

        if (nextValue.trim() === '') {
          onChange(0)
          return
        }

        const parsed = Number(nextValue)
        if (!Number.isFinite(parsed) || parsed < 0) {
          return
        }

        onChange(parsed)
      }}
      onBlur={() => {
        if (draft.trim() === '') {
          setDraft('')
        }
      }}
      onKeyDown={event => {
        if (event.key === '-' || event.key === 'e' || event.key === 'E' || event.key === '+') {
          event.preventDefault()
        }
      }}
    />
  )
}`.split(/\r?\n/)

const crewRoleStart = findLine(frontend, "function newCrewRole(role = 'Crew Role', sortOrder = 0): CrewPlanningRole {")
insertBefore(frontend, "function newCrewRole(role = 'Crew Role', sortOrder = 0): CrewPlanningRole {", ['', ...planningDecimalInput], crewRoleStart)

replaceLine(frontend, '          <div className="hidden rounded-[18px] border border-zinc-200 bg-zinc-100 px-4 py-3 md:grid md:grid-cols-[auto_auto_1.25fr_0.6fr_0.7fr_0.75fr_0.75fr_1fr_1fr_auto] md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">', '          <div className="hidden rounded-[18px] border border-zinc-200 bg-zinc-100 px-4 py-3 md:grid md:grid-cols-[auto_auto_1.25fr_0.6fr_0.7fr_0.75fr_0.75fr_0.75fr_1fr_1fr_auto] md:gap-3 dark:border-zinc-800 dark:bg-zinc-900">')
insertAfter(frontend, '            <PlanningColumnHeader help="Estimated cost per unit.">Rate</PlanningColumnHeader>', ['            <PlanningColumnHeader help="Recurring charge per day for rental-style expenses.">Daily Wage / Day</PlanningColumnHeader>'])
replaceLine(frontend, '      className={cn(\'grid gap-3 rounded-[24px] bg-zinc-50 p-4 select-none dark:bg-zinc-900 md:grid-cols-[auto_auto_1.25fr_0.6fr_0.7fr_0.75fr_0.75fr_1fr_1fr_auto]\', sortable.isDragging && \'ring-1 ring-orange-300 dark:ring-orange-500/40\')}', '      className={cn(\'grid gap-3 rounded-[24px] bg-zinc-50 p-4 select-none dark:bg-zinc-900 md:grid-cols-[auto_auto_1.25fr_0.6fr_0.7fr_0.75fr_0.75fr_0.75fr_1fr_1fr_auto]\', sortable.isDragging && \'ring-1 ring-orange-300 dark:ring-orange-500/40\')}')

const expenseRowStart = findLine(frontend, 'function ExpenseItemRow({')
insertBefore(frontend, '      <PlanningCell label="Buffer %">', [
  '      <PlanningCell label="Daily Wage / Day">',
  '        <PlanningDecimalInput',
  '          value={item.dailyWagePerDay}',
  '          ariaLabel="Daily Wage / Day"',
  '          onChange={dailyWagePerDay => onChange({ dailyWagePerDay })}',
  '        />',
  '      </PlanningCell>',
], expenseRowStart)

writeLines(frontendPath, frontend)

const backendPath = 'C:/Users/pande/ProdSync-2.0/backend/src/modules/projects/expenseTemplate.registry.ts'
const backend = readLines(backendPath)

insertAfter(backend, '  rate?: number', ['  dailyWagePerDay?: number'])
insertAfter(backend, '    rate: item.rate ?? 0,', ['    dailyWagePerDay: item.dailyWagePerDay ?? 0,'])
const backendCategoriesStart = findLine(backend, '    categories: departments.flatMap(department =>')
insertAfter(backend, '        rate: item.rate,', ['        dailyWagePerDay: item.dailyWagePerDay,'], backendCategoriesStart)

writeLines(backendPath, backend)
