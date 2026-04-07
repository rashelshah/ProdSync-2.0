export type WardrobeInventoryStatus = 'on_set' | 'in_storage' | 'in_laundry' | 'missing'
export type WardrobeLaundryStatus = 'sent' | 'in_cleaning' | 'returned' | 'delayed'
export type WardrobeAccessoryCategory = 'jewellery' | 'accessory'
export type WardrobeAccessoryStatus = 'on_set' | 'in_safe' | 'in_use' | 'missing'

export interface WardrobeContinuityLog {
  id: string
  projectId: string
  sceneNumber: string
  characterName: string
  actorName: string | null
  imageUrl: string | null
  notes: string | null
  createdById: string | null
  createdAt: string
}

export interface WardrobeInventoryItem {
  id: string
  projectId: string
  costumeName: string
  characterName: string | null
  actorName: string | null
  status: WardrobeInventoryStatus
  lastUsedScene: string | null
  assetCode: string | null
  createdAt: string
}

export interface WardrobeLaundryBatch {
  id: string
  projectId: string
  batchId: string
  items: string[]
  vendorName: string | null
  sentDate: string | null
  expectedReturnDate: string | null
  actualReturnDate: string | null
  status: WardrobeLaundryStatus
  createdAt: string
}

export interface WardrobeAccessoryItem {
  id: string
  projectId: string
  itemName: string
  category: WardrobeAccessoryCategory
  assignedCharacter: string | null
  status: WardrobeAccessoryStatus
  lastCheckinTime: string | null
  createdAt: string
}

export interface WardrobeAlert {
  type: 'warning' | 'critical'
  message: string
  timestamp: string
}

export interface CreateWardrobeContinuityInput {
  projectId: string
  sceneNumber: string
  characterName: string
  actorName?: string
  notes?: string
  image: File
}

export interface CreateWardrobeInventoryInput {
  projectId: string
  costumeName: string
  characterName?: string
  actorName?: string
  status: WardrobeInventoryStatus
  lastUsedScene?: string
}

export interface UpdateWardrobeInventoryInput {
  projectId: string
  status: WardrobeInventoryStatus
  lastUsedScene?: string
}

export interface CreateWardrobeLaundryInput {
  projectId: string
  batchId?: string
  items: string[]
  vendorName: string
  sentDate: string
  expectedReturnDate: string
  status: WardrobeLaundryStatus
}

export interface UpdateWardrobeLaundryInput {
  projectId: string
  status: WardrobeLaundryStatus
  actualReturnDate?: string
}

export interface CreateWardrobeAccessoryInput {
  projectId: string
  itemName: string
  category: WardrobeAccessoryCategory
  assignedCharacter?: string
  status: WardrobeAccessoryStatus
}

export interface UpdateWardrobeAccessoryInput {
  projectId: string
  status: WardrobeAccessoryStatus
  assignedCharacter?: string
}
