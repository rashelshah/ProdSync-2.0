import { randomUUID } from 'node:crypto'
import { adminClient } from '../../config/supabaseClient'
import { HttpError } from '../../utils/httpError'
import type {
  AllocationCreateInput,
  AllocationUpdateInput,
  HotelCreateInput,
  HotelUpdateInput,
} from './accommodation.schemas'

type DbRow = Record<string, unknown>
type AlertType = 'warning' | 'critical'
type BookingStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'

type HotelRecord = ReturnType<typeof mapHotelRow>
type AllocationRecord = ReturnType<typeof mapAllocationRow>
type ReminderRecord = ReturnType<typeof mapReminderRow>
type StayLogRecord = ReturnType<typeof mapStayLogRow>

type AccommodationMetadataStore = {
  hotels: DbRow[]
  allocations: DbRow[]
  reminders: DbRow[]
  stayLogs: DbRow[]
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.toLowerCase()
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return ((error as { message: string }).message).toLowerCase()
  }
  return ''
}

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code
  }
  return null
}

function isMissingRelationError(error: unknown, relationName?: string) {
  const message = errorMessage(error)
  return errorCode(error) === '42P01'
    || errorCode(error) === 'PGRST205'
    || (((message.includes('relation') && message.includes('does not exist'))
      || (message.includes('could not find') && message.includes('schema cache'))
      || message.includes('not found in the schema cache'))
      && (!relationName || message.includes(relationName.toLowerCase())))
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asObject(value: unknown): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DbRow
    : {}
}

function asObjectArray(value: unknown): DbRow[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => item as DbRow)
}

function asDateOnly(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return new Date().toISOString().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue
  const parsed = new Date(stringValue)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function asIsoTimestamp(value: unknown) {
  const stringValue = asString(value)
  if (!stringValue) return new Date().toISOString()
  const parsed = new Date(stringValue)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function activeBooking(status: string | null) {
  return status === 'confirmed' || status === 'checked_in'
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && startB <= endA
}

function reminderTimeFor(date: string, hoursBefore: number) {
  const base = new Date(`${date}T12:00:00.000Z`)
  base.setUTCHours(base.getUTCHours() - hoursBefore)
  return base.toISOString()
}

function buildAlert(type: AlertType, message: string, timestamp: string) {
  return { type, message, timestamp }
}

function mapHotelRow(row: DbRow) {
  return {
    id: String(row.id ?? ''),
    hotelName: asString(row.hotel_name) ?? '',
    address: asString(row.address) ?? '',
    city: asString(row.city) ?? '',
    contactPerson: asString(row.contact_person),
    contactNumber: asString(row.contact_number),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapAllocationRow(row: DbRow) {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    personName: asString(row.person_name) ?? '',
    roleTitle: asString(row.role_title),
    department: asString(row.department),
    hotelName: asString(row.hotel_name) ?? '',
    roomNumber: asString(row.room_number) ?? '',
    checkInDate: asDateOnly(row.check_in_date),
    checkOutDate: asDateOnly(row.check_out_date),
    bookingStatus: (asString(row.booking_status) ?? 'confirmed') as BookingStatus,
    notes: asString(row.notes),
    createdAt: asIsoTimestamp(row.created_at),
    updatedAt: asIsoTimestamp(row.updated_at),
  }
}

function mapReminderRow(row: DbRow) {
  return {
    id: String(row.id ?? ''),
    allocationId: String(row.allocation_id ?? ''),
    reminderType: (asString(row.reminder_type) ?? 'checkin') as 'checkin' | 'checkout',
    reminderTime: asIsoTimestamp(row.reminder_time),
    status: (asString(row.status) ?? 'pending') as 'pending' | 'sent',
    createdAt: asIsoTimestamp(row.created_at),
  }
}

function mapStayLogRow(row: DbRow) {
  return {
    id: String(row.id ?? ''),
    allocationId: String(row.allocation_id ?? ''),
    date: asDateOnly(row.date),
    status: asString(row.status) ?? 'present',
    remarks: asString(row.remarks),
    createdAt: asIsoTimestamp(row.created_at),
  }
}

async function getProjectMetadataStore(projectId: string): Promise<{ metadata: DbRow; store: AccommodationMetadataStore }> {
  const { data, error } = await adminClient
    .from('projects')
    .select('id, metadata')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new HttpError(404, 'Project not found.')
  }

  const metadata = asObject((data as DbRow).metadata)
  const accommodation = asObject(metadata.accommodation)

  return {
    metadata,
    store: {
      hotels: asObjectArray(accommodation.hotels),
      allocations: asObjectArray(accommodation.allocations),
      reminders: asObjectArray(accommodation.reminders),
      stayLogs: asObjectArray(accommodation.stayLogs),
    },
  }
}

async function saveProjectMetadataStore(projectId: string, metadata: DbRow, store: AccommodationMetadataStore) {
  const nextMetadata = {
    ...metadata,
    accommodation: {
      hotels: store.hotels,
      allocations: store.allocations,
      reminders: store.reminders,
      stayLogs: store.stayLogs,
    },
  }

  const { error } = await adminClient
    .from('projects')
    .update({ metadata: nextMetadata })
    .eq('id', projectId)

  if (error) {
    throw error
  }
}

function syncReminderRows(store: AccommodationMetadataStore, allocationId: string, checkInDate: string, checkOutDate: string) {
  store.reminders = store.reminders.filter(row => String(row.allocation_id ?? '') !== allocationId)
  store.reminders.push(
    {
      id: randomUUID(),
      allocation_id: allocationId,
      reminder_type: 'checkin',
      reminder_time: reminderTimeFor(checkInDate, 12),
      status: 'pending',
      created_at: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      allocation_id: allocationId,
      reminder_type: 'checkout',
      reminder_time: reminderTimeFor(checkOutDate, 6),
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  )
}

async function syncRemindersForAllocation(allocationId: string, checkInDate: string, checkOutDate: string) {
  const deletion = await adminClient.from('hotel_reminders').delete().eq('allocation_id', allocationId)
  if (deletion.error) {
    if (isMissingRelationError(deletion.error, 'hotel_reminders')) {
      throw deletion.error
    }
    throw deletion.error
  }

  const reminders = [
    { id: randomUUID(), allocation_id: allocationId, reminder_type: 'checkin', reminder_time: reminderTimeFor(checkInDate, 12), status: 'pending' },
    { id: randomUUID(), allocation_id: allocationId, reminder_type: 'checkout', reminder_time: reminderTimeFor(checkOutDate, 6), status: 'pending' },
  ]
  const insertion = await adminClient.from('hotel_reminders').insert(reminders)
  if (insertion.error) {
    throw insertion.error
  }
}

async function ensureNoConflicts(projectId: string, hotelName: string, roomNumber: string, checkInDate: string, checkOutDate: string, excludeId?: string) {
  const query = adminClient
    .from('hotel_allocations')
    .select('id, person_name, booking_status, check_in_date, check_out_date')
    .eq('project_id', projectId)
    .eq('hotel_name', hotelName)
    .eq('room_number', roomNumber)

  if (excludeId) query.neq('id', excludeId)

  const { data, error } = await query
  if (error) {
    throw error
  }

  for (const row of (data ?? []) as DbRow[]) {
    const status = asString(row.booking_status)
    if (!activeBooking(status)) continue
    if (datesOverlap(checkInDate, checkOutDate, asDateOnly(row.check_in_date), asDateOnly(row.check_out_date))) {
      throw new HttpError(409, `Room ${roomNumber} at ${hotelName} is already allocated to ${asString(row.person_name) ?? 'another guest'} for overlapping stay dates.`)
    }
  }
}

async function ensureNoFallbackConflicts(store: AccommodationMetadataStore, projectId: string, hotelName: string, roomNumber: string, checkInDate: string, checkOutDate: string, excludeId?: string) {
  for (const row of store.allocations) {
    if (excludeId && String(row.id ?? '') === excludeId) continue
    if (String(row.project_id ?? '') !== projectId) continue
    if ((asString(row.hotel_name) ?? '').toLowerCase() !== hotelName.toLowerCase()) continue
    if ((asString(row.room_number) ?? '').toLowerCase() !== roomNumber.toLowerCase()) continue
    const status = asString(row.booking_status)
    if (!activeBooking(status)) continue
    if (datesOverlap(checkInDate, checkOutDate, asDateOnly(row.check_in_date), asDateOnly(row.check_out_date))) {
      throw new HttpError(409, `Room ${roomNumber} at ${hotelName} is already allocated to ${asString(row.person_name) ?? 'another guest'} for overlapping stay dates.`)
    }
  }
}

export async function listHotels(projectId?: string | null): Promise<HotelRecord[]> {
  const { data, error } = await adminClient
    .from('hotels')
    .select('id, hotel_name, address, city, contact_person, contact_number, latitude, longitude, created_at')
    .order('hotel_name', { ascending: true })

  if (error) {
    if (isMissingRelationError(error, 'hotels') && projectId) {
      const { store } = await getProjectMetadataStore(projectId)
      return store.hotels.map(mapHotelRow).sort((left, right) => left.hotelName.localeCompare(right.hotelName))
    }
    if (isMissingRelationError(error, 'hotels')) {
      return []
    }
    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapHotelRow)
}

export async function createHotel(input: HotelCreateInput) {
  const insertion = await adminClient
    .from('hotels')
    .insert({
      hotel_name: input.hotelName,
      address: input.address,
      city: input.city,
      contact_person: input.contactPerson ?? null,
      contact_number: input.contactNumber ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .select('id, hotel_name, address, city, contact_person, contact_number, latitude, longitude, created_at')
    .single()

  if (insertion.error) {
    if (!isMissingRelationError(insertion.error, 'hotels') || !input.projectId) {
      throw insertion.error
    }

    const { metadata, store } = await getProjectMetadataStore(input.projectId)
    const hotelRow: DbRow = {
      id: randomUUID(),
      hotel_name: input.hotelName,
      address: input.address,
      city: input.city,
      contact_person: input.contactPerson ?? null,
      contact_number: input.contactNumber ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      created_at: new Date().toISOString(),
    }
    store.hotels.push(hotelRow)
    await saveProjectMetadataStore(input.projectId, metadata, store)
    return mapHotelRow(hotelRow)
  }

  return mapHotelRow(insertion.data as DbRow)
}

export async function updateHotel(id: string, input: HotelUpdateInput) {
  const updateQuery = await adminClient
    .from('hotels')
    .update({
      hotel_name: input.hotelName,
      address: input.address,
      city: input.city,
      contact_person: input.contactPerson,
      contact_number: input.contactNumber,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .eq('id', id)
    .select('id, hotel_name, address, city, contact_person, contact_number, latitude, longitude, created_at')
    .maybeSingle()

  if (updateQuery.error) {
    if (!isMissingRelationError(updateQuery.error, 'hotels') || !input.projectId) {
      throw updateQuery.error
    }

    const { metadata, store } = await getProjectMetadataStore(input.projectId)
    const hotelIndex = store.hotels.findIndex(row => String(row.id ?? '') === id)
    if (hotelIndex < 0) {
      throw new HttpError(404, 'Hotel not found.')
    }

    const current = store.hotels[hotelIndex]
    store.hotels[hotelIndex] = {
      ...current,
      hotel_name: input.hotelName ?? current.hotel_name,
      address: input.address ?? current.address,
      city: input.city ?? current.city,
      contact_person: input.contactPerson ?? current.contact_person ?? null,
      contact_number: input.contactNumber ?? current.contact_number ?? null,
      latitude: input.latitude ?? current.latitude ?? null,
      longitude: input.longitude ?? current.longitude ?? null,
    }
    await saveProjectMetadataStore(input.projectId, metadata, store)
    return mapHotelRow(store.hotels[hotelIndex])
  }

  if (!updateQuery.data) throw new HttpError(404, 'Hotel not found.')
  return mapHotelRow(updateQuery.data as DbRow)
}

export async function listAllocations(projectId: string): Promise<AllocationRecord[]> {
  const { data, error } = await adminClient
    .from('hotel_allocations')
    .select('id, project_id, person_name, role_title, department, hotel_name, room_number, check_in_date, check_out_date, booking_status, notes, created_at, updated_at')
    .eq('project_id', projectId)
    .order('check_in_date', { ascending: true })

  if (error) {
    if (isMissingRelationError(error, 'hotel_allocations')) {
      const { store } = await getProjectMetadataStore(projectId)
      return store.allocations
        .filter(row => String(row.project_id ?? '') === projectId)
        .map(mapAllocationRow)
        .sort((left, right) => left.checkInDate.localeCompare(right.checkInDate))
    }
    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapAllocationRow)
}

export async function createAllocation(input: AllocationCreateInput) {
  const checkInDate = asDateOnly(input.checkInDate)
  const checkOutDate = asDateOnly(input.checkOutDate)
  if (checkOutDate < checkInDate) throw new HttpError(400, 'Check-out date cannot be earlier than check-in date.')

  try {
    await ensureNoConflicts(input.projectId, input.hotelName, input.roomNumber, checkInDate, checkOutDate)

    const existingQuery = await adminClient
      .from('hotel_allocations')
      .select('id, booking_status')
      .eq('project_id', input.projectId)
      .eq('person_name', input.personName)

    if (existingQuery.error) throw existingQuery.error
    if (((existingQuery.data ?? []) as DbRow[]).some(row => activeBooking(asString(row.booking_status)))) {
      throw new HttpError(409, `${input.personName} already has an active hotel allocation.`)
    }

    const insertion = await adminClient
      .from('hotel_allocations')
      .insert({
        project_id: input.projectId,
        person_name: input.personName,
        role_title: input.roleTitle ?? null,
        department: input.department ?? null,
        hotel_name: input.hotelName,
        room_number: input.roomNumber,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        booking_status: input.bookingStatus,
        notes: input.notes ?? null,
      })
      .select('id, project_id, person_name, role_title, department, hotel_name, room_number, check_in_date, check_out_date, booking_status, notes, created_at, updated_at')
      .single()

    if (insertion.error) throw insertion.error
    const allocation = mapAllocationRow(insertion.data as DbRow)
    await syncRemindersForAllocation(allocation.id, allocation.checkInDate, allocation.checkOutDate)
    return allocation
  } catch (error) {
    if (!isMissingRelationError(error, 'hotel_allocations') && !isMissingRelationError(error, 'hotel_reminders')) {
      throw error
    }

    const { metadata, store } = await getProjectMetadataStore(input.projectId)
    await ensureNoFallbackConflicts(store, input.projectId, input.hotelName, input.roomNumber, checkInDate, checkOutDate)
    if (store.allocations.some(row => String(row.project_id ?? '') === input.projectId && (asString(row.person_name) ?? '') === input.personName && activeBooking(asString(row.booking_status)))) {
      throw new HttpError(409, `${input.personName} already has an active hotel allocation.`)
    }

    const now = new Date().toISOString()
    const allocationRow: DbRow = {
      id: randomUUID(),
      project_id: input.projectId,
      person_name: input.personName,
      role_title: input.roleTitle ?? null,
      department: input.department ?? null,
      hotel_name: input.hotelName,
      room_number: input.roomNumber,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      booking_status: input.bookingStatus,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    }
    store.allocations.push(allocationRow)
    syncReminderRows(store, String(allocationRow.id), checkInDate, checkOutDate)
    await saveProjectMetadataStore(input.projectId, metadata, store)
    return mapAllocationRow(allocationRow)
  }
}

export async function updateAllocation(id: string, input: AllocationUpdateInput) {
  const currentQuery = await adminClient
    .from('hotel_allocations')
    .select('id, project_id, person_name, role_title, department, hotel_name, room_number, check_in_date, check_out_date, booking_status, notes, created_at, updated_at')
    .eq('project_id', input.projectId)
    .eq('id', id)
    .maybeSingle()

  if (!currentQuery.error) {
    if (!currentQuery.data) throw new HttpError(404, 'Allocation not found.')

    const current = mapAllocationRow(currentQuery.data as DbRow)
    const next = {
      personName: input.personName ?? current.personName,
      roleTitle: input.roleTitle ?? current.roleTitle,
      department: input.department ?? current.department,
      hotelName: input.hotelName ?? current.hotelName,
      roomNumber: input.roomNumber ?? current.roomNumber,
      checkInDate: input.checkInDate ? asDateOnly(input.checkInDate) : current.checkInDate,
      checkOutDate: input.checkOutDate ? asDateOnly(input.checkOutDate) : current.checkOutDate,
      bookingStatus: input.bookingStatus ?? current.bookingStatus,
      notes: input.notes ?? current.notes,
    }

    if (next.checkOutDate < next.checkInDate) throw new HttpError(400, 'Check-out date cannot be earlier than check-in date.')
    if (activeBooking(next.bookingStatus)) {
      await ensureNoConflicts(input.projectId, next.hotelName, next.roomNumber, next.checkInDate, next.checkOutDate, id)
    }

    const updated = await adminClient
      .from('hotel_allocations')
      .update({
        person_name: next.personName,
        role_title: next.roleTitle ?? null,
        department: next.department ?? null,
        hotel_name: next.hotelName,
        room_number: next.roomNumber,
        check_in_date: next.checkInDate,
        check_out_date: next.checkOutDate,
        booking_status: next.bookingStatus,
        notes: next.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', input.projectId)
      .eq('id', id)
      .select('id, project_id, person_name, role_title, department, hotel_name, room_number, check_in_date, check_out_date, booking_status, notes, created_at, updated_at')
      .single()

    if (!updated.error) {
      const allocation = mapAllocationRow(updated.data as DbRow)
      try {
        await syncRemindersForAllocation(allocation.id, allocation.checkInDate, allocation.checkOutDate)
      } catch (syncError) {
        if (!isMissingRelationError(syncError, 'hotel_reminders')) {
          throw syncError
        }
      }

      const stayLogInsert = await adminClient.from('stay_logs').insert({
        allocation_id: allocation.id,
        date: new Date().toISOString().slice(0, 10),
        status: allocation.bookingStatus === 'checked_out' ? 'checked_out' : 'present',
        remarks: allocation.notes ?? null,
      })

      if (stayLogInsert.error && !isMissingRelationError(stayLogInsert.error, 'stay_logs')) {
        throw stayLogInsert.error
      }

      return allocation
    }

    if (!isMissingRelationError(updated.error, 'hotel_allocations')) {
      throw updated.error
    }
  } else if (!isMissingRelationError(currentQuery.error, 'hotel_allocations')) {
    throw currentQuery.error
  }

  const { metadata, store } = await getProjectMetadataStore(input.projectId)
  const currentIndex = store.allocations.findIndex(row => String(row.project_id ?? '') === input.projectId && String(row.id ?? '') === id)
  if (currentIndex < 0) {
    throw new HttpError(404, 'Allocation not found.')
  }

  const currentRow = store.allocations[currentIndex]
  const current = mapAllocationRow(currentRow)
  const next = {
    personName: input.personName ?? current.personName,
    roleTitle: input.roleTitle ?? current.roleTitle,
    department: input.department ?? current.department,
    hotelName: input.hotelName ?? current.hotelName,
    roomNumber: input.roomNumber ?? current.roomNumber,
    checkInDate: input.checkInDate ? asDateOnly(input.checkInDate) : current.checkInDate,
    checkOutDate: input.checkOutDate ? asDateOnly(input.checkOutDate) : current.checkOutDate,
    bookingStatus: input.bookingStatus ?? current.bookingStatus,
    notes: input.notes ?? current.notes,
  }

  if (next.checkOutDate < next.checkInDate) throw new HttpError(400, 'Check-out date cannot be earlier than check-in date.')
  if (activeBooking(next.bookingStatus)) {
    await ensureNoFallbackConflicts(store, input.projectId, next.hotelName, next.roomNumber, next.checkInDate, next.checkOutDate, id)
  }

  const nextRow: DbRow = {
    ...currentRow,
    person_name: next.personName,
    role_title: next.roleTitle ?? null,
    department: next.department ?? null,
    hotel_name: next.hotelName,
    room_number: next.roomNumber,
    check_in_date: next.checkInDate,
    check_out_date: next.checkOutDate,
    booking_status: next.bookingStatus,
    notes: next.notes ?? null,
    updated_at: new Date().toISOString(),
  }
  store.allocations[currentIndex] = nextRow
  syncReminderRows(store, id, next.checkInDate, next.checkOutDate)
  store.stayLogs.push({
    id: randomUUID(),
    allocation_id: id,
    date: new Date().toISOString().slice(0, 10),
    status: next.bookingStatus === 'checked_out' ? 'checked_out' : 'present',
    remarks: next.notes ?? null,
    created_at: new Date().toISOString(),
  })
  await saveProjectMetadataStore(input.projectId, metadata, store)
  return mapAllocationRow(nextRow)
}

export async function deleteAllocation(projectId: string, id: string) {
  const deletion = await adminClient.from('hotel_allocations').delete().eq('project_id', projectId).eq('id', id)
  if (deletion.error) {
    if (!isMissingRelationError(deletion.error, 'hotel_allocations')) {
      throw deletion.error
    }

    const { metadata, store } = await getProjectMetadataStore(projectId)
    store.allocations = store.allocations.filter(row => !(String(row.project_id ?? '') === projectId && String(row.id ?? '') === id))
    store.reminders = store.reminders.filter(row => String(row.allocation_id ?? '') !== id)
    store.stayLogs = store.stayLogs.filter(row => String(row.allocation_id ?? '') !== id)
    await saveProjectMetadataStore(projectId, metadata, store)
    return { ok: true }
  }
  return { ok: true }
}

export async function listReminders(projectId: string): Promise<ReminderRecord[]> {
  const { data, error } = await adminClient
    .from('hotel_reminders')
    .select('id, allocation_id, reminder_type, reminder_time, status, created_at, hotel_allocations!inner(project_id)')
    .eq('hotel_allocations.project_id', projectId)
    .order('reminder_time', { ascending: true })

  if (error) {
    if (isMissingRelationError(error, 'hotel_reminders') || isMissingRelationError(error, 'hotel_allocations')) {
      const { store } = await getProjectMetadataStore(projectId)
      return store.reminders
        .map(mapReminderRow)
        .sort((left, right) => left.reminderTime.localeCompare(right.reminderTime))
    }
    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapReminderRow)
}

export async function listStayLogs(projectId: string): Promise<StayLogRecord[]> {
  const { data, error } = await adminClient
    .from('stay_logs')
    .select('id, allocation_id, date, status, remarks, created_at, hotel_allocations!inner(project_id)')
    .eq('hotel_allocations.project_id', projectId)
    .order('date', { ascending: false })

  if (error) {
    if (isMissingRelationError(error, 'stay_logs') || isMissingRelationError(error, 'hotel_allocations')) {
      const { store } = await getProjectMetadataStore(projectId)
      return store.stayLogs
        .map(mapStayLogRow)
        .sort((left, right) => right.date.localeCompare(left.date))
    }
    throw error
  }

  return ((data ?? []) as DbRow[]).map(mapStayLogRow)
}

async function getProjectLocations(projectId: string) {
  const { data, error } = await adminClient
    .from('project_locations')
    .select('name, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error && !isMissingRelationError(error, 'project_locations')) throw error
  const row = ((data ?? []) as DbRow[])[0]
  return asString(row?.name) ?? 'Shoot location'
}

async function getUpcomingCallTimes(projectId: string) {
  const { data, error } = await adminClient
    .from('call_sheets')
    .select('actor_name, call_time, shoot_date, location')
    .eq('project_id', projectId)
    .gte('shoot_date', new Date().toISOString().slice(0, 10))
    .order('shoot_date', { ascending: true })
    .order('call_time', { ascending: true })

  if (error && !isMissingRelationError(error, 'call_sheets')) throw error
  return (data ?? []) as DbRow[]
}

async function getAssignedVehicles(projectId: string) {
  const { data, error } = await adminClient
    .from('trips')
    .select('metadata, created_at, vehicle:vehicles!trips_vehicle_id_fkey(name, registration_number)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error && !isMissingRelationError(error, 'trips')) throw error
  return (data ?? []) as DbRow[]
}

export async function getTravelSync(projectId: string) {
  const [allocations, hotels, callSheets, vehicles, shootLocation] = await Promise.all([
    listAllocations(projectId),
    listHotels(projectId),
    getUpcomingCallTimes(projectId),
    getAssignedVehicles(projectId),
    getProjectLocations(projectId),
  ])

  return allocations
    .filter(allocation => activeBooking(allocation.bookingStatus))
    .map(allocation => {
      const hotel = hotels.find(item => item.hotelName.toLowerCase() === allocation.hotelName.toLowerCase())
      const callSheet = callSheets.find(row => (asString(row.actor_name) ?? '').toLowerCase() === allocation.personName.toLowerCase())
      const vehicleRecord = vehicles.find(row => {
        const metadata = row.metadata as DbRow | null
        return (asString(metadata?.person_name) ?? '').toLowerCase() === allocation.personName.toLowerCase()
      })
      const vehicle = vehicleRecord?.vehicle as DbRow | undefined

      return {
        person_name: allocation.personName,
        hotel_name: allocation.hotelName,
        pickup_location: hotel?.address ?? allocation.hotelName,
        drop_location: asString(callSheet?.location) ?? shootLocation,
        call_time: asString(callSheet?.call_time) ?? null,
        assigned_vehicle: asString(vehicle?.name) ?? asString(vehicle?.registration_number) ?? null,
      }
    })
}

export async function listAccommodationAlerts(projectId: string) {
  const [allocations, hotels, reminders, travelSync, stayLogs] = await Promise.all([
    listAllocations(projectId),
    listHotels(projectId),
    listReminders(projectId),
    getTravelSync(projectId),
    listStayLogs(projectId),
  ])

  const alerts: Array<{ type: AlertType; message: string; timestamp: string }> = []
  const now = new Date()
  const nowIso = now.toISOString()
  const hotelNames = new Set(hotels.map(item => item.hotelName.toLowerCase()))

  for (const allocation of allocations) {
    if (!hotelNames.has(allocation.hotelName.toLowerCase())) {
      alerts.push(buildAlert('warning', `${allocation.personName} has a room allocation for ${allocation.hotelName}, but the hotel is missing from the directory.`, nowIso))
    }
    if (!allocation.roomNumber.trim()) {
      alerts.push(buildAlert('critical', `${allocation.personName} is missing a room assignment.`, allocation.updatedAt))
    }
    if (activeBooking(allocation.bookingStatus)) {
      const checkout = new Date(`${allocation.checkOutDate}T12:00:00.000Z`)
      const diffHours = (checkout.getTime() - now.getTime()) / 36e5
      if (diffHours <= 24 && diffHours >= 0) {
        alerts.push(buildAlert('warning', `${allocation.personName} is due to check out within 24 hours.`, allocation.updatedAt))
      }
      if (diffHours < 0) {
        alerts.push(buildAlert('critical', `${allocation.personName} may be overstaying at ${allocation.hotelName}.`, allocation.updatedAt))
      }
    }
  }

  for (const reminder of reminders) {
    if (reminder.reminderType === 'checkout' && reminder.status === 'pending' && new Date(reminder.reminderTime).getTime() < now.getTime()) {
      alerts.push(buildAlert('warning', 'A checkout reminder is overdue and may indicate missing checkout confirmation.', reminder.reminderTime))
    }
  }

  const logsByAllocation = new Map<string, StayLogRecord[]>()
  for (const log of stayLogs) {
    const bucket = logsByAllocation.get(log.allocationId) ?? []
    bucket.push(log)
    logsByAllocation.set(log.allocationId, bucket)
  }

  for (const allocation of allocations) {
    const logs = logsByAllocation.get(allocation.id) ?? []
    if (logs.some(log => log.status === 'extended')) {
      alerts.push(buildAlert('warning', `${allocation.personName} has an extended stay logged.`, logs[0]?.createdAt ?? allocation.updatedAt))
    }
  }

  for (const allocation of allocations.filter(item => activeBooking(item.bookingStatus))) {
    const conflicts = allocations.filter(other => other.id !== allocation.id
      && other.hotelName.toLowerCase() === allocation.hotelName.toLowerCase()
      && other.roomNumber.toLowerCase() === allocation.roomNumber.toLowerCase()
      && activeBooking(other.bookingStatus)
      && datesOverlap(allocation.checkInDate, allocation.checkOutDate, other.checkInDate, other.checkOutDate))
    if (conflicts.length > 0) {
      alerts.push(buildAlert('critical', `Hotel overbooking conflict detected for room ${allocation.roomNumber} at ${allocation.hotelName}.`, allocation.updatedAt))
    }
  }

  for (const travel of travelSync) {
    if (!travel.pickup_location || !travel.drop_location) {
      alerts.push(buildAlert('warning', `Transport mismatch detected for ${travel.person_name}.`, nowIso))
    }
  }

  return alerts.sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, 20)
}
