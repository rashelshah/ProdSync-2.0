export interface AccommodationHotel {
  id: string
  hotelName: string
  address: string
  city: string
  contactPerson: string | null
  contactNumber: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
}

export interface CreateAccommodationHotelInput {
  projectId?: string
  hotelName: string
  address: string
  city: string
  contactPerson?: string
  contactNumber?: string
}

export interface UpdateAccommodationHotelInput extends Partial<CreateAccommodationHotelInput> {}

export interface HotelAllocation {
  id: string
  projectId: string
  personName: string
  roleTitle: string | null
  department: string | null
  hotelName: string
  roomNumber: string
  checkInDate: string
  checkOutDate: string
  bookingStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateHotelAllocationInput {
  projectId: string
  personName: string
  roleTitle?: string
  department?: string
  hotelName: string
  roomNumber: string
  checkInDate: string
  checkOutDate: string
  bookingStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  notes?: string
}

export interface UpdateHotelAllocationInput extends Partial<Omit<CreateHotelAllocationInput, 'projectId'>> {
  projectId: string
}

export interface HotelReminder {
  id: string
  allocationId: string
  reminderType: 'checkin' | 'checkout'
  reminderTime: string
  status: 'pending' | 'sent'
  createdAt: string
}

export interface TravelSyncItem {
  person_name: string
  hotel_name: string
  pickup_location: string | null
  drop_location?: string | null
  call_time: string | null
  assigned_vehicle: string | null
}

export interface AccommodationAlert {
  type: 'warning' | 'critical'
  message: string
  timestamp: string
}
