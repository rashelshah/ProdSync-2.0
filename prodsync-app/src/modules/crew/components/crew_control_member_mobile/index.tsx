import { useState } from 'react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CrewGeofenceMap } from '../../components/CrewGeofenceMap'
import { cn, formatCurrency, formatDate, formatTime } from '@/utils'
import type { CrewAttendanceHistoryItem, CrewProjectLocation, WagePayout, CrewLocationPoint } from '@/types'
import { useMobileScrollHide } from '@/hooks/useMobileScrollHide'
import { LiquidGlassNavbar } from '@/components/shared/LiquidGlassNavbar'

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${remainingSeconds}`
}

function formatDurationMinutes(minutes: number) {
  if (minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours <= 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

function payoutStatusVariant(status: WagePayout['status']) {
  if (status === 'paid') return 'paid' as const
  if (status === 'approved') return 'approved' as const
  if (status === 'rejected') return 'rejected' as const
  return 'requested' as const
}

export interface MyShiftState {
  attendanceId: string | null
  state: 'not_checked_in' | 'checked_in' | 'checked_out'
  checkInTime: string | null
  checkOutTime: string | null
  workingSeconds: number
  otActive: boolean
  otMinutes: number
  geoVerified: boolean
  checkInLocation: CrewLocationPoint | null
  shiftStatus: string
}

export type AttendanceHistoryPreset = 'last_5_days' | 'last_30_days' | 'last_2_months' | 'custom'

export interface CrewControlMemberMobileProps {
  myShift: MyShiftState
  permissions: { canCheckIn: boolean; canCheckOut: boolean; canRequestBatta?: boolean }
  shiftGpsError: string | null
  activeAction: string | null
  projectLocation: CrewProjectLocation | null
  handleShiftStart: () => Promise<void>
  handleShiftEnd: () => Promise<void>
  liveWorkingSeconds: number
  battaAmount: string
  setBattaAmount: (val: string) => void
  handleBattaRequest: () => Promise<void>
  currentAttendancePayout: WagePayout | undefined
  myPayouts: WagePayout[]
  // Attendance History Props
  attendanceHistoryQ: any
  historyPreset: AttendanceHistoryPreset
  setHistoryPreset: (val: AttendanceHistoryPreset) => void
  customStartDate: string
  setCustomStartDate: (val: string) => void
  customEndDate: string
  setCustomEndDate: (val: string) => void
  historyPage: number
  setHistoryPage: (page: number | ((prev: number) => number)) => void
  onExport: () => Promise<void>
}

export function CrewControlMemberMobile(props: CrewControlMemberMobileProps) {
  const [activeMobileTab, setActiveMobileTab] = useState<'dashboard' | 'payments' | 'records'>('dashboard')
  const { navRef: bottomNavRef } = useMobileScrollHide()

  const shiftWidgetUI = (
    <div className="rounded-[32px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] p-6 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Current Status</p>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${props.myShift.state === 'checked_in' ? 'bg-orange-500' : 'bg-zinc-500'}`}></span>
            <span className="text-sm font-bold tracking-widest text-zinc-900 dark:text-white uppercase">
              {props.myShift.state === 'checked_in' ? 'Checked In' : props.myShift.state === 'checked_out' ? 'Checked Out' : 'Not Started'}
            </span>
          </div>
        </div>
        <div className="rounded-full bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-200 dark:border-white/5 px-3 py-1.5 flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-[13px] ${props.myShift.geoVerified ? 'text-orange-500' : 'text-zinc-500'}`} style={{fontVariationSettings: "'FILL' 1"}}>
            {props.myShift.geoVerified ? 'check_circle' : 'pending'}
          </span>
          <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-700 dark:text-zinc-300">
            {props.myShift.geoVerified ? 'Verified' : 'Pending'}
          </span>
        </div>
      </div>

      <div className="flex gap-8 mb-8">
        <div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Working Time</p>
          <p className="font-headline text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tighter">
            {formatDuration(props.liveWorkingSeconds)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">OT Minutes</p>
          <p className="font-headline text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tighter">
            {props.myShift.otMinutes}
          </p>
        </div>
      </div>

      {props.permissions.canCheckIn && props.myShift.state === 'not_checked_in' && (
        <button
          onClick={() => void props.handleShiftStart()}
          disabled={props.activeAction !== null}
          className="w-full h-[56px] rounded-[18px] bg-orange-500 text-black font-bold text-[12px] uppercase tracking-[0.15em] shadow-[0_12px_24px_rgba(249,115,22,0.25)] active:scale-95 transition-transform disabled:opacity-50"
        >
          {props.activeAction === 'crew-check-in' ? 'Checking In...' : 'Start Shift'}
        </button>
      )}
      {props.permissions.canCheckOut && props.myShift.state === 'checked_in' && (
        <button
          onClick={() => void props.handleShiftEnd()}
          disabled={props.activeAction !== null}
          className="w-full h-[56px] rounded-[18px] bg-orange-500 text-black font-bold text-[12px] uppercase tracking-[0.15em] shadow-[0_12px_24px_rgba(249,115,22,0.25)] active:scale-95 transition-transform disabled:opacity-50"
        >
          {props.activeAction === 'crew-check-out' ? 'Ending...' : 'End Shift'}
        </button>
      )}
    </div>
  )

  const checkInOutUI = (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div className="rounded-[24px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] p-5">
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Check-In</p>
        <p className="text-sm font-bold text-zinc-900 dark:text-white mb-0.5">
          {props.myShift.checkInTime ? formatDate(props.myShift.checkInTime) : '--'}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {props.myShift.checkInTime ? formatTime(props.myShift.checkInTime) : '--:-- --'}
        </p>
      </div>
      <div className="rounded-[24px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] p-5">
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Check-Out</p>
        <p className="text-sm font-bold text-orange-600 dark:text-orange-500 mb-0.5">
          {props.myShift.checkOutTime ? formatDate(props.myShift.checkOutTime) : 'Working'}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {props.myShift.checkOutTime ? formatTime(props.myShift.checkOutTime) : '--:-- --'}
        </p>
      </div>
    </div>
  )

  const geofenceUI = (
    <div className="mt-8 space-y-4">
      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] px-1">Project Geofence</p>
      {props.shiftGpsError && (
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-2">
          <p className="text-xs text-orange-500 font-bold uppercase tracking-wider mb-2">GPS Retry Needed</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">{props.shiftGpsError}</p>
          <button
            onClick={() => {
              if (props.myShift.state === 'checked_in') {
                void props.handleShiftEnd()
                return
              }
              void props.handleShiftStart()
            }}
            className="px-4 py-2 rounded-xl bg-orange-500 text-black text-[10px] font-bold uppercase tracking-widest w-full"
            disabled={props.activeAction !== null}
          >
            Retry GPS Check
          </button>
        </div>
      )}
      <div className="overflow-hidden relative h-[180px] rounded-[32px] border border-zinc-200 dark:border-white/5 shadow-sm">
        <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none bg-emerald-500 z-10" />
        <CrewGeofenceMap 
          center={props.projectLocation?.latitude != null && props.projectLocation?.longitude != null ? { lat: Number(props.projectLocation.latitude), lng: Number(props.projectLocation.longitude), accuracy: null, timestamp: new Date().toISOString() } : null} 
          radiusMeters={props.projectLocation?.radiusMeters ?? 200} 
          editable={false} 
        />
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 to-transparent pointer-events-none z-20 flex justify-between items-end">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-orange-500">location_on</span>
            <span className="text-[11px] font-bold text-white leading-tight">
              {props.projectLocation?.name || 'Unknown Location'}
            </span>
          </div>
          <span className="px-2 py-1 rounded bg-black/50 border border-white/10 text-[8px] font-bold tracking-widest text-white uppercase backdrop-blur-md">Read Only</span>
        </div>
      </div>
    </div>
  )

  const battaFlowUI = props.permissions.canRequestBatta ? (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">Batta Flow</p>
        <button className="material-symbols-outlined text-[14px] text-zinc-400">info</button>
      </div>
      <div className="rounded-[32px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] p-5 flex items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">₹</span>
          <input
            type="number"
            min={0}
            step={100}
            value={props.battaAmount}
            onChange={e => props.setBattaAmount(e.target.value)}
            placeholder="0.00"
            className="w-full h-[48px] rounded-[16px] border-none bg-zinc-100 dark:bg-[#1e1f22] pl-[28px] pr-4 text-sm font-medium text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-orange-500/50 transition-shadow appearance-none"
          />
        </div>
        <button
          onClick={() => void props.handleBattaRequest()}
          disabled={!props.myShift.attendanceId || !props.battaAmount || Boolean(props.currentAttendancePayout) || props.activeAction !== null}
          className="h-[48px] px-5 rounded-[16px] bg-orange-50 dark:bg-[#28150d] text-orange-600 dark:text-orange-500 font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 min-w-max"
        >
          {props.activeAction === 'crew-batta-request' ? 'Requesting...' : 'Request Batta'}
        </button>
      </div>
      {props.currentAttendancePayout && (
        <p className="text-[10px] text-orange-600 px-2 font-medium tracking-wide">
           A batta request already exists for the current attendance record. Status: {props.currentAttendancePayout.status}.
        </p>
      )}
    </div>
  ) : null

  const attendanceHistory = props.attendanceHistoryQ.data?.data ?? []
  const attendancePagination = props.attendanceHistoryQ.data?.pagination

  const historyUI = (
    <div className="mt-8 space-y-6">
      <div className="px-1">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">Attendance History</p>
          <button 
            onClick={() => void props.onExport()}
            disabled={props.attendanceHistoryQ.isFetching || attendanceHistory.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-black text-[9px] font-bold uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            Export PDF
          </button>
        </div>

        {/* Filter Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'last_5_days' as const, label: '5D' },
            { id: 'last_30_days' as const, label: '30D' },
            { id: 'last_2_months' as const, label: '2M' },
            { id: 'custom' as const, label: 'Custom' },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => props.setHistoryPreset(option.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all",
                props.historyPreset === option.id
                  ? "bg-orange-500 border-orange-500 text-black shadow-lg shadow-orange-500/20"
                  : "bg-white dark:bg-[#151618] border-zinc-200 dark:border-white/5 text-zinc-500"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {props.historyPreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest px-1">Start Date</p>
              <input
                type="date"
                value={props.customStartDate}
                onChange={e => props.setCustomStartDate(e.target.value)}
                className="w-full h-[40px] rounded-[12px] bg-zinc-100 dark:bg-[#1e1f22] border-none text-[11px] font-medium text-zinc-900 dark:text-white px-3 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest px-1">End Date</p>
              <input
                type="date"
                value={props.customEndDate}
                onChange={e => props.setCustomEndDate(e.target.value)}
                className="w-full h-[40px] rounded-[12px] bg-zinc-100 dark:bg-[#1e1f22] border-none text-[11px] font-medium text-zinc-900 dark:text-white px-3 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 min-h-[200px]">
        {props.attendanceHistoryQ.isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="w-6 h-6 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : attendanceHistory.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-zinc-200 dark:border-white/10 p-10 flex flex-col items-center justify-center text-center opacity-60">
             <span className="material-symbols-outlined text-[32px] mb-3 text-zinc-400">history</span>
             <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
               No attendance records<br/>found for this range
             </p>
          </div>
        ) : (
          <>
            {attendanceHistory.map((row: CrewAttendanceHistoryItem) => (
              <div key={row.attendanceId || row.id} className="rounded-[24px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] p-4 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-[16px] bg-zinc-100 dark:bg-[#1e1f22] flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-zinc-500 dark:text-zinc-400">calendar_today</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-zinc-900 dark:text-white truncate">
                    {row.checkInTime ? formatDate(row.checkInTime) : '--'}
                  </p>
                  <p className="text-[9px] text-zinc-500 mt-0.5 uppercase tracking-wider truncate">
                    {row.checkInTime ? formatTime(row.checkInTime) : '--'} - {row.checkOutTime ? formatTime(row.checkOutTime) : 'Working'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-white">
                    {formatDurationMinutes(row.durationMinutes)}
                  </p>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold tracking-widest uppercase",
                    row.state === 'checked_out' 
                      ? "bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400"
                      : "bg-orange-500/10 text-orange-500"
                  )}>
                    {row.shiftStatus}
                  </span>
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                disabled={props.historyPage <= 1}
                onClick={() => props.setHistoryPage(p => Math.max(1, p - 1))}
                className="flex-1 h-[44px] rounded-[16px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-30"
              >
                Previous
              </button>
              <div className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                {props.historyPage} / {attendancePagination?.totalPages || 1}
              </div>
              <button
                disabled={props.historyPage >= (attendancePagination?.totalPages || 1)}
                onClick={() => props.setHistoryPage(p => p + 1)}
                className="flex-1 h-[44px] rounded-[16px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  const payoutsUI = props.permissions.canRequestBatta ? (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">Payout History</p>
      </div>
      <div className="flex flex-col gap-3">
        {props.myPayouts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-zinc-200 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center opacity-60">
             <span className="material-symbols-outlined text-[24px] mb-2 text-zinc-400">receipt_long</span>
             <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">No Payouts</p>
          </div>
        ) : (
          props.myPayouts.map(payout => (
            <div key={payout.id} className="rounded-[24px] border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#151618] p-4 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-[16px] bg-zinc-100 dark:bg-[#1e1f22] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[20px] text-zinc-500 dark:text-zinc-400">payments</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-zinc-900 dark:text-white truncate">
                  {formatCurrency(payout.amount)}
                </p>
                <p className="text-[9px] text-zinc-500 mt-0.5 uppercase tracking-wider truncate">
                  {formatDate(payout.timestamp)} | {payout.method}
                </p>
              </div>
              <div className="flex-shrink-0 scale-90 origin-right">
                <StatusBadge variant={payoutStatusVariant(payout.status)} label={payout.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="flex flex-col md:hidden pb-[140px] pt-2 min-h-screen">
      
      {/* Universal Page Header */}
      <header className="px-3 mb-6">
        <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
          <span className="page-kicker text-orange-500">Attendance & Shifts</span>
          <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Crew Control</h1>
          <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">
            Personal check-in and attendance history.
          </p>
        </div>
      </header>

      {/* Tabs Content */}
      <div className="px-3">
        {activeMobileTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {shiftWidgetUI}
            {checkInOutUI}
            {geofenceUI}
            {battaFlowUI}
            {historyUI}
          </div>
        )}

        {activeMobileTab === 'payments' && props.permissions.canRequestBatta && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            {battaFlowUI}
            {payoutsUI}
          </div>
        )}
        
        {activeMobileTab === 'records' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            {historyUI}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <LiquidGlassNavbar
        ref={bottomNavRef}
        activeTabId={activeMobileTab}
        onTabChange={(id) => setActiveMobileTab(id as any)}
        tabs={[
          { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
          ...(props.permissions.canRequestBatta ? [{ id: 'payments', icon: 'payments', label: 'Payments' }] : []),
          { id: 'records', icon: 'history', label: 'Records' },
        ]}
      />
    </div>
  )
}
