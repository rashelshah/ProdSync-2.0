export type ActorPaymentType = 'batta' | 'remuneration'
export type ActorPaymentStatus = 'pending' | 'paid'

export interface JuniorArtistLog {
  id: string
  projectId: string
  shootDate: string
  agentName: string
  numberOfArtists: number
  ratePerArtist: number
  totalCost: number
  createdById: string | null
  createdAt: string
}

export interface ActorCallSheet {
  id: string
  projectId: string
  shootDate: string
  location: string
  locationId: string | null
  callType: ActorCallSheetType
  timeIn: string
  timeOut: string
  callTime: string
  actorName: string
  characterName: string | null
  assignments: ActorCallSheetAssignment[]
  notes: string | null
  createdAt: string
}

export interface ActorCallSheetGroup {
  shootDate: string
  entries: ActorCallSheet[]
}

export interface ActorPayment {
  id: string
  projectId: string
  actorName: string
  paymentType: ActorPaymentType
  amount: number
  paymentDate: string
  status: ActorPaymentStatus
  createdAt: string
}

export interface ActorLook {
  id: string
  projectId: string
  actorName: string
  characterName: string | null
  imageUrl: string | null
  notes: string | null
  createdAt: string
}

export interface ActorAlert {
  type: 'warning' | 'critical'
  message: string
  timestamp: string
}

export type ActorCallSheetType = 'standard' | 'one_and_half' | 'double' | 'custom'
export type ActorCallSheetAssignmentType = 'actor' | 'crew'

export interface ActorCallSheetAssignment {
  id?: string
  assignmentType: ActorCallSheetAssignmentType
  actorName?: string | null
  characterName?: string | null
  crewMemberId?: string | null
  crewName?: string | null
  department?: string | null
  designation?: string | null
}

export interface ActorProjectLocation {
  id: string
  name: string
}

export interface ActorCrewMemberOption {
  id: string
  name: string
  department: string
  designation: string
}

export interface CreateJuniorArtistLogInput {
  projectId: string
  shootDate: string
  agentName: string
  numberOfArtists: number
  ratePerArtist: number
}

export interface CreateActorCallSheetInput {
  projectId: string
  shootDate: string
  locationId: string
  location?: string
  callType: ActorCallSheetType
  timeIn: string
  timeOut: string
  callTime?: string
  assignmentType: ActorCallSheetAssignmentType
  assignments: ActorCallSheetAssignment[]
  actorName?: string
  characterName?: string
  notes?: string
}

export interface CreateActorPaymentInput {
  projectId: string
  actorName: string
  paymentType: ActorPaymentType
  amount: number
  paymentDate: string
  status?: ActorPaymentStatus
}

export interface UpdateActorPaymentInput {
  projectId: string
  status: ActorPaymentStatus
}

export interface CreateActorLookInput {
  projectId: string
  actorName: string
  characterName?: string
  notes?: string
  image: File
}
