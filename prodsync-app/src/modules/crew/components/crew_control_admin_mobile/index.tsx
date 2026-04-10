import { Dispatch, SetStateAction, useState } from 'react'
import { CrewGeofenceMap } from '../../components/CrewGeofenceMap'
import { cn, formatCurrency, formatTime } from '@/utils'
import type { CrewMember, CrewLocationPoint, WagePayout, CrewProjectLocation } from '@/types'
import { useMobileScrollHide } from '@/hooks/useMobileScrollHide'

type PaymentMethod = 'UPI' | 'CASH' | 'BANK'
type LocationSearchResult = { name: string; lat: number; lng: number }

export interface CrewControlAdminMobileProps {
  summary: { totalCrew: number; activeOTCrew: number; totalOTCost: number; battaRequested: number; battaPaid: number }
  canSeeFinancials: boolean
  canSeeFullCrew: boolean
  canManageGeofence: boolean
  
  // Geofence state
  projectLocation: CrewProjectLocation | null
  mapCenter: CrewLocationPoint | null
  radiusMeters: number
  locationName: string
  isEditingGeofence: boolean
  locationSearch: string
  searchResults: LocationSearchResult[]
  searchError: string | null
  isSearching: boolean
  deviceLocationName: string
  locationGpsError: string | null
  isFetchingLocation: boolean
  isLocationDraftDirty: boolean
  activeAction: string | null
  
  // Geofence setters
  setMapCenter: (point: CrewLocationPoint | null) => void
  setIsLocationDraftDirty: (dirty: boolean) => void
  setLocationSearch: (search: string) => void
  setSearchError: (error: string | null) => void
  setLocationName: (name: string) => void
  setRadiusMeters: (radius: number) => void
  
  // Geofence actions
  beginGeofenceEditing: () => void
  cancelGeofenceEditing: () => void
  handleSearchSelection: (result: LocationSearchResult) => void
  fetchCurrentLocationIntoDraft: () => void
  handleProjectLocationSave: () => void
  
  // Queue
  showManagerQueueInline: boolean
  canManageBatta: boolean
  battaQueue: WagePayout[]
  paymentMethods: Record<string, PaymentMethod>
  setPaymentMethods: Dispatch<SetStateAction<Record<string, PaymentMethod>>>
  handleApproveBatta: (payoutId: string) => Promise<void>
  handleMarkPaid: (payoutId: string) => Promise<void>
  
  // Crew
  canSeeCrewTable: boolean
  crew: CrewMember[]
}

const inputClass =
  'w-full rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-400 dark:border-white/10 dark:bg-zinc-950 dark:text-white'

const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5'

function formatCoordinates(location: CrewLocationPoint | null | undefined) {
  if (!location) return '--'
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
}

export function CrewControlAdminMobile(props: CrewControlAdminMobileProps) {
  const [activeMobileTab, setActiveMobileTab] = useState<'home' | 'crew' | 'payments' | 'location'>('home')
  const { navRef: bottomNavRef } = useMobileScrollHide()

  const mobileStats = [
    { label: 'Visible Crew', value: String(props.summary.totalCrew) },
    { label: 'Active OT Crew', value: String(props.summary.activeOTCrew) },
    ...(props.canSeeFinancials ? [
      { label: 'Batta Requested', value: formatCurrency(props.summary.battaRequested) },
      { label: 'Batta Paid', value: formatCurrency(props.summary.battaPaid) },
    ] : [])
  ]

  const locationMonitoringUI = (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-900 dark:text-white">Location Monitoring</h2>
        <div className="h-[1px] flex-1 bg-zinc-200 dark:bg-white/5"></div>
      </div>

      <div className="rounded-[32px] overflow-hidden relative h-[320px] shadow-sm border border-zinc-200 dark:border-white/5">
        <CrewGeofenceMap
          center={props.mapCenter}
          radiusMeters={props.radiusMeters}
          editable={props.canManageGeofence && props.isEditingGeofence}
          onCenterChange={async next => {
            props.setMapCenter(next)
            props.setIsLocationDraftDirty(true)
            
            try {
               const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${next.lat}&lon=${next.lng}&format=json`)
               const data = await res.json()
               if (data && data.display_name) {
                 props.setLocationName(data.display_name)
                 props.setLocationSearch(data.display_name)
               }
            } catch (e) {
               console.error('OSM Reverse Geocoding failed:', e)
            }
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
          <div className="flex items-center justify-between">
             <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-orange-400">OpenStreetMap Geofence</p>
             <span className="px-2 py-1 rounded bg-white/20 text-[9px] font-bold text-white uppercase backdrop-blur-md">
               {props.isEditingGeofence ? 'EDITING' : 'VIEW ONLY'}
             </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-white tracking-tight">{props.locationName || props.projectLocation?.name || 'Unset'}</p>
          <div className="mt-4 flex gap-8">
             <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Radius</p>
                <p className="mt-0.5 text-sm font-bold text-white">{props.radiusMeters}m</p>
             </div>
             <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Coordinates</p>
                <p className="mt-0.5 text-sm font-bold text-white">{formatCoordinates(props.mapCenter)}</p>
             </div>
          </div>
        </div>
      </div>

      {props.canManageGeofence && !props.isEditingGeofence && (
        <button type="button" onClick={props.beginGeofenceEditing} className="mt-4 h-[48px] w-full rounded-[16px] border border-zinc-200 dark:border-white/10 dark:text-white text-[11px] font-bold tracking-widest uppercase active:scale-95 transition-transform flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[18px]">edit</span> Edit Location
        </button>
      )}

      {props.canManageGeofence && props.isEditingGeofence && (
        <div className="mt-4 space-y-4 rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#111]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Search Location</label>
              <div className="relative">
                <input
                  value={props.locationSearch}
                  onChange={event => {
                    props.setLocationSearch(event.target.value)
                    props.setSearchError(null)
                  }}
                  placeholder="Search OpenStreetMap"
                  className={inputClass}
                />
                {(props.isSearching || props.searchResults.length > 0 || props.searchError) && (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-[20px] border border-zinc-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-950">
                    {props.isSearching && <p className="px-3 py-2 text-sm text-zinc-500">Searching...</p>}
                    {!props.isSearching && props.searchResults.map(result => (
                      <button
                        key={`${result.name}-${result.lat}-${result.lng}`}
                        type="button"
                        onClick={() => props.handleSearchSelection(result)}
                        className="flex w-full flex-col rounded-[16px] px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-white/5"
                      >
                        <span className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">{result.name}</span>
                        <span className="text-[9px] text-zinc-500 tracking-wider">Lat: {result.lat.toFixed(5)}, Lng: {result.lng.toFixed(5)}</span>
                      </button>
                    ))}
                    {props.searchError && <p className="px-3 py-2 text-sm text-zinc-500">{props.searchError}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Location Label</label>
              <input
                value={props.locationName}
                onChange={event => {
                  props.setLocationName(event.target.value)
                  props.setIsLocationDraftDirty(true)
                }}
                className={inputClass}
                placeholder="Project Base"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Radius</span>
                <span>{props.radiusMeters} m</span>
              </div>
              <input
                type="range"
                min={50}
                max={1000}
                step={10}
                value={props.radiusMeters}
                onChange={event => {
                  props.setRadiusMeters(Number(event.target.value))
                  props.setIsLocationDraftDirty(true)
                }}
                className="w-full accent-orange-500"
              />
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-zinc-200 dark:border-white/10">
              <button type="button" onClick={() => void props.fetchCurrentLocationIntoDraft()} className={secondaryButtonClass} disabled={props.isFetchingLocation}>
                <span className="material-symbols-outlined text-sm">my_location</span>
                {props.isFetchingLocation ? 'Fetching GPS...' : 'Use Current GPS'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={props.cancelGeofenceEditing} className={cn(secondaryButtonClass, "border-transparent bg-zinc-100 dark:bg-white/5 w-full")}>Cancel</button>
              <button onClick={() => void props.handleProjectLocationSave()} disabled={!props.mapCenter || !props.isLocationDraftDirty} className="w-full h-[44px] rounded-[22px] bg-orange-500 text-black font-bold text-[11px] uppercase tracking-widest disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const battaRequestsUI = (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-900 dark:text-white">Batta Requests</h2>
          <div className="h-[1px] w-8 bg-zinc-200 dark:bg-white/5"></div>
        </div>
        <span className="px-2 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-500 rounded-md text-[9px] font-bold uppercase tracking-widest">
          {props.battaQueue.filter(q => q.status === 'requested').length} PENDING
        </span>
      </div>

      {props.battaQueue.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-zinc-300 dark:border-white/10 p-8 flex flex-col items-center justify-center text-center opacity-60">
          <span className="material-symbols-outlined text-4xl mb-3 text-zinc-400">payments</span>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Queue Clear</p>
        </div>
      ) : (
        props.battaQueue.map(payout => (
          <div key={payout.id} className="rounded-[24px] bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 p-4 shadow-sm flex flex-col">
            <div className="flex justify-between items-start">
              <div className="flex gap-3 items-center">
                 <div className="w-10 h-10 rounded-[12px] bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-sm font-extrabold text-zinc-900 dark:text-white">
                   {payout.crewName.substring(0, 2).toUpperCase()}
                 </div>
                 <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{payout.crewName}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Department: {payout.department}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(payout.amount)}</p>
                 <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Via {payout.method}</p>
              </div>
            </div>

            {payout.status === 'requested' && (
              <div className="grid grid-cols-2 gap-3 mt-5 border-t border-zinc-100 dark:border-white/5 pt-4">
                 <button onClick={() => void props.handleApproveBatta(payout.id)} disabled={props.activeAction !== null} className="h-[44px] rounded-[14px] bg-orange-500 text-black font-bold text-[11px] uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-orange-500/20 disabled:opacity-50">
                    {props.activeAction === `approve-${payout.id}` ? 'Approving' : 'Approve'}
                 </button>
                 <button className="h-[44px] rounded-[14px] bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-600 font-bold text-[11px] uppercase tracking-widest cursor-not-allowed">
                    Mark Paid
                 </button>
              </div>
            )}
            
            {payout.status === 'approved' && (
              <div className="grid grid-cols-2 gap-3 mt-5 border-t border-zinc-100 dark:border-white/5 pt-4">
                 <div className="relative">
                   <select
                     value={props.paymentMethods[payout.id] ?? 'CASH'}
                     onChange={event => props.setPaymentMethods(current => ({ ...current, [payout.id]: event.target.value as PaymentMethod }))}
                     className="w-full h-[44px] rounded-[14px] bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white text-center font-bold text-[11px] uppercase tracking-widest border-none outline-none appearance-none"
                   >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK">Bank</option>
                   </select>
                   <span className="material-symbols-outlined absolute right-3 top-3.5 text-[16px] text-zinc-500 pointer-events-none">expand_more</span>
                 </div>
                 <button onClick={() => void props.handleMarkPaid(payout.id)} disabled={props.activeAction !== null} className="h-[44px] rounded-[14px] bg-zinc-900 dark:bg-white/10 text-white font-bold text-[11px] uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50">
                    {props.activeAction === `pay-${payout.id}` ? 'Paying' : 'Mark Paid'}
                 </button>
              </div>
            )}

            {payout.status === 'paid' && (
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 dark:border-white/5 pt-3">
                 <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Settled</span>
                 </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )

  const activeCrewUI = (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-900 dark:text-white">Active Crew</h2>
        <div className="h-[1px] flex-1 bg-zinc-200 dark:bg-white/5"></div>
      </div>

      {props.crew.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-zinc-300 dark:border-white/10 p-8 flex flex-col items-center justify-center text-center opacity-60">
          <span className="material-symbols-outlined text-4xl mb-3 text-zinc-400">person_add</span>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Awaiting Shift Start</p>
        </div>
      ) : (
        props.crew.map(row => (
          <div key={row.attendanceId ?? row.id} className="rounded-[24px] bg-white dark:bg-[#111] border border-zinc-200 dark:border-white/5 p-4 shadow-sm flex items-center justify-between">
             <div className="flex gap-3 items-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                    <span className="text-zinc-500 dark:text-zinc-400 font-bold tracking-widest text-xs">{row.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white dark:border-[#111] rounded-full ${row.status === 'offduty' ? 'bg-zinc-400 dark:bg-zinc-600' : 'bg-emerald-500'}`}></div>
                </div>
                <div>
                   <p className="text-sm font-bold text-zinc-900 dark:text-white mb-1 leading-none">{row.name}</p>
                   <div className="flex items-center gap-2 mt-1">
                     <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold tracking-widest uppercase border ${row.status === 'offduty' ? 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20'}`}>
                       {row.status === 'offduty' ? 'Off Duty' : row.status === 'ot' ? 'OT Active' : 'Working'}
                     </span>
                     <span className="text-[9px] text-zinc-500 font-medium tracking-wide">
                       {row.checkInTime ? `Since ${formatTime(row.checkInTime)}` : '--'}
                     </span>
                   </div>
                   <p className="text-[9px] text-zinc-400 mt-1.5 uppercase tracking-widest">{row.role}</p>
                </div>
             </div>
             <div className="flex flex-col items-end gap-1">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${row.status === 'offduty' ? 'text-zinc-400' : 'text-orange-600 dark:text-orange-500'}`}>
                  {row.status === 'offduty' ? 'Checked Out' : 'Checked In'}
                </span>
                <button className="material-symbols-outlined text-zinc-300 dark:text-zinc-600 text-[18px] mt-1">more_vert</button>
             </div>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="flex flex-col md:hidden pb-[140px] pt-2 min-h-screen">
      
      {/* Universal Page Header overlay */}
      <header className="px-3 mb-6">
        <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/88 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-zinc-900/82 dark:shadow-[0_20px_44px_rgba(0,0,0,0.32)]">
          <span className="page-kicker text-orange-500">Attendance & Geofence</span>
          <h1 className="page-title page-title-compact mt-1 text-zinc-900 dark:text-white">Crew Control Center</h1>
          <p className="page-subtitle mt-2 text-zinc-500 dark:text-zinc-400">
            {props.canSeeFullCrew ? 'Project-wide operational visibility.' : 'Department-scoped visibility.'}
          </p>
        </div>
      </header>

      {activeMobileTab === 'home' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 space-y-8">
          {/* LIVE INSIGHTS (Arts section stats UI) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Live Insights</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {mobileStats.map(card => (
                <div
                  key={card.label}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-md min-w-0 flex flex-col justify-between"
                >
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{card.label}</span>
                  <div className="font-headline font-extrabold text-zinc-900 dark:text-white mt-1 break-words w-full tracking-tighter" style={{ fontSize: String(card.value).length > 10 ? '1.35rem' : String(card.value).length > 6 ? '1.7rem' : '2rem' }}>{card.value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* LOCATION MONITORING append */}
          {locationMonitoringUI}

          {/* Batta Requests append */}
          {battaRequestsUI}

          {/* Active Crew append */}
          {activeCrewUI}

        </div>
      )}

      {activeMobileTab === 'payments' && (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300 px-3 space-y-4">
          {battaRequestsUI}
        </div>
      )}

      {activeMobileTab === 'crew' && (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300 px-3 space-y-4">
          {activeCrewUI}
        </div>
      )}
      
      {activeMobileTab === 'location' && (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300 px-3 space-y-4">
          {locationMonitoringUI}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav ref={bottomNavRef} className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex h-[80px] max-w-md items-center justify-around rounded-[30px] border border-zinc-200/80 bg-white/88 px-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/8 dark:bg-[#0a0a0a]/82 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
        {[
          { id: 'home', icon: 'home', label: 'Home' },
          { id: 'location', icon: 'my_location', label: 'Location' },
          { id: 'crew', icon: 'groups', label: 'Crew' },
          { id: 'payments', icon: 'payments', label: 'Payments' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMobileTab(tab.id as any)}
            className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[20px] py-1.5 transition-all duration-200 ${activeMobileTab === tab.id ? 'bg-orange-500/10 text-orange-600 dark:text-orange-500 dark:bg-[#1a140d]' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`}
          >
             <span className={`material-symbols-outlined text-[24px] ${activeMobileTab === tab.id ? 'scale-105' : ''}`} style={activeMobileTab === tab.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
             <span className="text-[9px] font-bold uppercase tracking-[0.05em]">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
