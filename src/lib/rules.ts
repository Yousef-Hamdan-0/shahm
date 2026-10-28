import type { Captain, Fils, Order, OrderStatus, WalletTx } from './types'

// ---------------------------------------------------------------------------
// Order state machine
// ---------------------------------------------------------------------------

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_dispatch: ['awaiting_captain', 'offered_privately', 'cancelled'],
  awaiting_captain: ['accepted', 'pending_dispatch', 'offered_privately', 'cancelled'],
  offered_privately: ['accepted', 'pending_dispatch', 'dispatch_expired', 'cancelled'],
  dispatch_expired: ['awaiting_captain', 'offered_privately', 'cancelled'],
  accepted: ['heading_to_pickup', 'cancelled'],
  heading_to_pickup: ['picked_up', 'cancelled'],
  picked_up: ['on_the_way', 'cancelled'],
  on_the_way: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to)

/** The single forward step a captain may take from each delivery stage. */
export const CAPTAIN_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted: 'heading_to_pickup',
  heading_to_pickup: 'picked_up',
  picked_up: 'on_the_way',
  on_the_way: 'delivered',
}

export const DELIVERY_STAGES: OrderStatus[] = [
  'accepted',
  'heading_to_pickup',
  'picked_up',
  'on_the_way',
  'delivered',
]

export const ACTIVE_DELIVERY: OrderStatus[] = ['accepted', 'heading_to_pickup', 'picked_up', 'on_the_way']
export const DISPATCH_QUEUE: OrderStatus[] = ['pending_dispatch', 'dispatch_expired']
export const UNASSIGNED: OrderStatus[] = [
  'pending_dispatch',
  'awaiting_captain',
  'offered_privately',
  'dispatch_expired',
]

export const isActiveDelivery = (o: Order) => ACTIVE_DELIVERY.includes(o.status)
export const isOpen = (o: Order) => o.status !== 'delivered' && o.status !== 'cancelled'

// ---------------------------------------------------------------------------
// Wallet accounting (derived entirely from the transaction ledger)
//   total     = recharges − debits
//   reserved  = reservations − releases − debits   (a debit consumes a reservation)
//   available = total − reserved
// ---------------------------------------------------------------------------

export interface WalletSummary {
  available: Fils
  reserved: Fils
  total: Fils
}

export function walletOf(txs: WalletTx[], captainId: string): WalletSummary {
  let recharge = 0
  let reservation = 0
  let release = 0
  let debit = 0
  for (const t of txs) {
    if (t.captainId !== captainId) continue
    if (t.type === 'recharge') recharge += t.amount
    else if (t.type === 'reservation') reservation += t.amount
    else if (t.type === 'release') release += t.amount
    else if (t.type === 'debit') debit += t.amount
  }
  const total = recharge - debit
  const reserved = reservation - release - debit
  return { total, reserved, available: total - reserved }
}

/** Reservation state of one order, so completion/cancellation is applied exactly once. */
export function reservationState(txs: WalletTx[], orderId: string): 'none' | 'reserved' | 'debited' | 'released' {
  const own = txs.filter((t) => t.orderId === orderId)
  if (own.some((t) => t.type === 'debit')) return 'debited'
  if (own.some((t) => t.type === 'release')) return 'released'
  if (own.some((t) => t.type === 'reservation')) return 'reserved'
  return 'none'
}

// ---------------------------------------------------------------------------
// Captain eligibility
// ---------------------------------------------------------------------------

export const LOCATION_STALE_MS = 2 * 60 * 1000

export const gpsHealthy = (c: Captain) => c.gpsMode !== 'off' && !c.gpsLost

export function locationIsStale(c: Captain, now = Date.now()) {
  return !gpsHealthy(c) || now - c.locationUpdatedAt > LOCATION_STALE_MS
}

export function activeOrderOf(orders: Order[], captainId: string) {
  return orders.find((o) => o.captainId === captainId && isActiveDelivery(o)) ?? null
}

export const WALLET_EMPTY_MSG = 'رصيد محفظتك غير كافٍ لاستقبال الطلبات. يرجى التواصل مع الإدارة لشحن الرصيد.'

/** Reasons a captain cannot switch to "available". Empty array = allowed. */
export function availabilityBlockers(c: Captain, orders: Order[], txs: WalletTx[]): string[] {
  const reasons: string[] = []
  if (c.status !== 'active') reasons.push('حسابك موقوف من قبل الإدارة.')
  if (activeOrderOf(orders, c.id)) reasons.push('لديك توصيلة نشطة. أكملها أولاً.')
  if (!gpsHealthy(c)) reasons.push('خدمة الموقع غير مفعّلة أو الإشارة مفقودة.')
  if (walletOf(txs, c.id).available <= 0) reasons.push(WALLET_EMPTY_MSG)
  return reasons
}

/** Reasons a captain cannot take a specific order. Empty array = eligible. */
export function orderBlockers(c: Captain, order: Order, orders: Order[], txs: WalletTx[]): string[] {
  const reasons: string[] = []
  if (c.status !== 'active') reasons.push('حساب الكابتن موقوف')
  if (!c.available) reasons.push('الكابتن غير متاح')
  if (!gpsHealthy(c)) reasons.push('الموقع غير مفعّل')
  const active = activeOrderOf(orders, c.id)
  if (active && active.id !== order.id) reasons.push('لديه توصيلة نشطة')
  if (walletOf(txs, c.id).available < order.fee) reasons.push('رصيد المحفظة أقل من رسوم الطلب')
  return reasons
}

/** Orders that appear in a captain's "available orders" feed. */
export function feedFor(c: Captain, orders: Order[], txs: WalletTx[]): Order[] {
  return orders
    .filter((o) => {
      if (o.status === 'awaiting_captain') return !o.dismissedBy.includes(c.id)
      if (o.status === 'offered_privately') return o.privateCaptainId === c.id
      return false
    })
    .filter((o) => orderBlockers(c, o, orders, txs).length === 0)
    .sort((a, b) => {
      // Exclusive offers first, then newest
      if (a.status !== b.status) return a.status === 'offered_privately' ? -1 : 1
      return b.createdAt - a.createdAt
    })
}

// ---------------------------------------------------------------------------
// Geography helpers
// ---------------------------------------------------------------------------

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Move a point toward a target by up to `stepKm`. */
export function stepToward(lat: number, lng: number, tLat: number, tLng: number, stepKm = 0.35) {
  const d = distanceKm(lat, lng, tLat, tLng)
  if (d <= stepKm) return { lat: tLat, lng: tLng }
  const f = stepKm / d
  return { lat: lat + (tLat - lat) * f, lng: lng + (tLng - lng) * f }
}

export const mapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

export const AMMAN_CENTER: [number, number] = [31.9539, 35.9106]
