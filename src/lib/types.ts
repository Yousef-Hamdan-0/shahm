/** All monetary amounts are integer fils (1 JOD = 1000 fils). */
export type Fils = number

export type Role = 'admin' | 'merchant' | 'captain'

export type AccountStatus = 'active' | 'inactive'

export interface Merchant {
  id: string
  name: string
  category: string
  ownerName: string
  phone: string
  address: string
  area: string
  lat: number
  lng: number
  status: AccountStatus
  createdAt: number
  username: string
  password: string
}

export type VehicleType = 'motorcycle' | 'car' | 'bicycle' | 'van'

/** demo = simulated coordinates, browser = real navigator.geolocation, off = no location */
export type GpsMode = 'demo' | 'browser' | 'off'

export interface CaptainRating {
  id: string
  stars: number
  note: string
  createdAt: number
}

export interface Captain {
  id: string
  /** Short demo label, e.g. "A" – used by the presenter to find seeded wallet cases */
  code: string
  name: string
  phone: string
  vehicleType: VehicleType
  vehicleId: string
  status: AccountStatus
  /** Captain-controlled flag. "Busy" is derived from having an active delivery. */
  available: boolean
  gpsMode: GpsMode
  /** Simulated or real signal loss while gpsMode is not "off" */
  gpsLost: boolean
  lat: number
  lng: number
  locationUpdatedAt: number
  ratings: CaptainRating[]
  createdAt: number
  username: string
  password: string
}

export type OrderStatus =
  | 'pending_dispatch'
  | 'awaiting_captain'
  | 'offered_privately'
  | 'accepted'
  | 'heading_to_pickup'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled'
  | 'dispatch_expired'

export type Actor = 'admin' | 'merchant' | 'captain' | 'system'

export interface TimelineEntry {
  status: OrderStatus
  at: number
  by: Actor
  note?: string
}

export interface Order {
  id: string
  ref: string
  merchantId: string
  customerName: string
  customerPhone: string
  dropoffAddress: string
  dropoffArea: string
  dropoffLat: number
  dropoffLng: number
  locationNotes: string
  pickupAddress: string
  pickupArea: string
  pickupLat: number
  pickupLng: number
  fee: Fils
  instructions: string
  merchantRef: string
  status: OrderStatus
  captainId: string | null
  /** Captain holding an exclusive offer (status offered_privately) */
  privateCaptainId: string | null
  privateOfferExpiresAt: number | null
  /** True when the order was held back because public broadcasting was off */
  pausedByBroadcast: boolean
  dismissedBy: string[]
  /** Captains that rejected a private offer for this order */
  rejectedBy: string[]
  timeline: TimelineEntry[]
  createdAt: number
  createdBy: Actor
}

export type WalletTxType = 'recharge' | 'reservation' | 'debit' | 'release'

export interface WalletTx {
  id: string
  captainId: string
  type: WalletTxType
  amount: Fils
  orderId: string | null
  note: string
  createdAt: number
}

export interface Settings {
  publicBroadcasting: boolean
  privateOfferTtlMin: number
  autoSimulateMovement: boolean
}

export interface Session {
  role: Role
  merchantId: string | null
  captainId: string | null
}

export interface DailyStat {
  /** days ago (6..1) */
  daysAgo: number
  created: number
  delivered: number
}

export interface Result {
  ok: boolean
  error?: string
}
