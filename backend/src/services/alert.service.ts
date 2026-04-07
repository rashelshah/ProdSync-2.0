import { adminClient } from '../config/supabaseClient'
import type { AlertsListQuery } from '../models/transport.schemas'
import type { PaginatedResult, TransportAlertRecord } from '../models/transport.types'
import { emitTransportEvent } from '../realtime/socket'
import { rangeFromPagination, toPaginatedResult } from '../utils/pagination'
import { createTransportApproval } from './transportApproval.service'

function toAlertRecord(row: Record<string, unknown>): TransportAlertRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    vehicleId: row.vehicle_id ? String(row.vehicle_id) : null,
    tripId: row.trip_id ? String(row.trip_id) : null,
    fuelLogId: row.fuel_log_id ? String(row.fuel_log_id) : null,
    severity: String(row.severity) as TransportAlertRecord['severity'],
    alertType: String(row.alert_type),
    title: String(row.title),
    message: String(row.message),
    status: String(row.status) as TransportAlertRecord['status'],
    triggeredAt: String(row.triggered_at),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  }
}

export async function listTransportAlerts(query: AlertsListQuery): Promise<PaginatedResult<TransportAlertRecord>> {
  const { from, to } = rangeFromPagination(query)
  let request = adminClient
    .from('transport_alerts')
    .select('*', { count: 'exact' })
    .eq('project_id', query.projectId)
    .order('triggered_at', { ascending: false })
    .range(from, to)

  if (query.status) {
    request = request.eq('status', query.status)
  }

  const { data, error, count } = await request
  if (error) {
    throw error
  }

  return toPaginatedResult((data ?? []).map(item => toAlertRecord(item as Record<string, unknown>)), count ?? 0, query)
}

export interface CreateAlertInput {
  projectId: string
  vehicleId?: string | null
  tripId?: string | null
  fuelLogId?: string | null
  requestedBy?: string | null
  severity: TransportAlertRecord['severity']
  alertType: string
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export async function createTransportAlert(input: CreateAlertInput): Promise<TransportAlertRecord> {
  const { data, error } = await adminClient
    .from('transport_alerts')
    .insert({
      project_id: input.projectId,
      vehicle_id: input.vehicleId ?? null,
      trip_id: input.tripId ?? null,
      fuel_log_id: input.fuelLogId ?? null,
      severity: input.severity,
      alert_type: input.alertType,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const record = toAlertRecord(data as Record<string, unknown>)

  if (input.alertType === 'abnormal_trip' && input.tripId) {
    void createTransportApproval({
      projectId: input.projectId,
      requestedBy: input.requestedBy ?? null,
      referenceId: input.tripId,
      referenceTable: 'trips',
      source: 'trip_alert',
      title: input.title,
      description: input.message,
      priority: input.severity === 'critical' ? 'emergency' : input.severity === 'warning' ? 'high' : 'normal',
      metadata: {
        alertId: record.id,
        alertType: input.alertType,
        vehicleId: input.vehicleId ?? null,
      },
    }).catch(error => {
      console.warn('[transport][approvals] failed to create trip approval', {
        projectId: input.projectId,
        tripId: input.tripId,
        error: error instanceof Error ? error.message : error,
      })
    })
  }

  if (
    input.fuelLogId &&
    ['fuel_mismatch', 'high_fuel_usage', 'odometer_mismatch'].includes(input.alertType)
  ) {
    void createTransportApproval({
      projectId: input.projectId,
      requestedBy: input.requestedBy ?? null,
      referenceId: input.fuelLogId,
      referenceTable: 'fuel_logs',
      source: 'fuel_alert',
      title: input.title,
      description: input.message,
      priority: input.severity === 'critical' ? 'emergency' : 'high',
      metadata: {
        alertId: record.id,
        alertType: input.alertType,
        tripId: input.tripId ?? null,
        vehicleId: input.vehicleId ?? null,
      },
    }).catch(error => {
      console.warn('[transport][approvals] failed to create fuel approval', {
        projectId: input.projectId,
        fuelLogId: input.fuelLogId,
        error: error instanceof Error ? error.message : error,
      })
    })
  }

  emitTransportEvent('alert_created', {
    projectId: record.projectId,
    entityId: record.id,
    type: record.alertType,
    data: record,
  })

  return record
}
