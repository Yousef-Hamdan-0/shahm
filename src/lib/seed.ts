import { jodToFils } from './format'
import type { Actor, Captain, DailyStat, Merchant, Order, OrderStatus, Settings, TimelineEntry, WalletTx } from './types'

/** Approximate neighbourhood centres in Amman (demo coordinates only). */
export const AREA_COORDS: Record<string, [number, number]> = {
  'عبدون': [31.942, 35.889],
  'الصويفية': [31.956, 35.862],
  'جبل عمّان': [31.951, 35.915],
  'الشميساني': [31.973, 35.901],
  'خلدا': [31.996, 35.846],
  'دابوق': [31.989, 35.825],
  'تلاع العلي': [32.009, 35.858],
  'الجبيهة': [32.026, 35.869],
  'مرج الحمام': [31.892, 35.834],
  'الرابية': [31.978, 35.87],
  'أم أذينة': [31.9655, 35.877],
  'اللويبدة': [31.959, 35.923],
  'وسط البلد': [31.952, 35.934],
  'طبربور': [32.002, 35.937],
}

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export interface SeedState {
  merchants: Merchant[]
  captains: Captain[]
  orders: Order[]
  txs: WalletTx[]
  settings: Settings
  dailyStats: DailyStat[]
  nextRef: number
}

export function buildSeed(now = Date.now()): SeedState {
  const at = (minutesAgo: number) => now - minutesAgo * MIN

  const merchantRows: [string, string, string, string, string, string, number][] = [
    // name, category, owner, phone, area, street, daysAgo
    ['مطعم بيت الزيتون', 'مطعم', 'سامر الحداد', '0795550112', 'الصويفية', 'شارع الوكالات، مجمع 14', 120],
    ['مقهى ركوة', 'مقهى', 'ليلى العبادي', '0785550147', 'اللويبدة', 'شارع باريس، بناية 7', 96],
    ['مخبز السنابل', 'مخبز', 'خالد النسور', '0775550163', 'الشميساني', 'شارع عبدالحميد شرف، 22', 80],
    ['صيدلية الندى', 'صيدلية', 'رنا المصري', '0795550188', 'خلدا', 'شارع وصفي التل، مجمع النخيل', 61],
    ['حلويات قصر الكنافة', 'حلويات', 'محمود الزعبي', '0785550109', 'جبل عمّان', 'الدوار الثالث، شارع الأمير محمد', 45],
    ['متجر أناقة للهدايا', 'متجر تجزئة', 'دانة الطراونة', '0775550131', 'عبدون', 'شارع القاهرة، مجمع عبدون التجاري', 20],
  ]
  const merchants: Merchant[] = merchantRows.map(([name, category, ownerName, phone, area, street, daysAgo], i) => {
    const [lat, lng] = AREA_COORDS[area]
    return {
      id: `m${i + 1}`,
      name,
      category,
      ownerName,
      phone,
      area,
      address: `${area}، ${street}`,
      lat: lat + 0.0012 * (i % 3),
      lng: lng - 0.001 * (i % 2),
      status: 'active',
      createdAt: now - daysAgo * DAY,
      username: `merchant${i + 1}`,
      password: 'demo1234',
    }
  })

  type CaptainRow = {
    code: string
    name: string
    phone: string
    vehicleType: Captain['vehicleType']
    vehicleId: string
    area: string
    available: boolean
    status: Captain['status']
    gpsMode: Captain['gpsMode']
    stars: number[]
    daysAgo: number
    /** desired available balance after the seeded ledger, in JOD */
    targetJod: number
  }
  const captainRows: CaptainRow[] = [
    { code: 'A', name: 'أحمد الخطيب', phone: '0795551201', vehicleType: 'motorcycle', vehicleId: '22-41873', area: 'وسط البلد', available: true, status: 'active', gpsMode: 'demo', stars: [4, 5], daysAgo: 70, targetJod: 0 },
    { code: 'B', name: 'باسل العمري', phone: '0785551202', vehicleType: 'motorcycle', vehicleId: '22-55190', area: 'الرابية', available: true, status: 'active', gpsMode: 'demo', stars: [4], daysAgo: 64, targetJod: 1 },
    { code: 'C', name: 'كريم الشوبكي', phone: '0775551203', vehicleType: 'car', vehicleId: '13-77402', area: 'أم أذينة', available: true, status: 'active', gpsMode: 'demo', stars: [5, 4, 5], daysAgo: 58, targetJod: 5 },
    { code: 'D', name: 'داود الحياري', phone: '0795551204', vehicleType: 'motorcycle', vehicleId: '22-60318', area: 'الشميساني', available: true, status: 'active', gpsMode: 'demo', stars: [5, 5], daysAgo: 50, targetJod: 10 },
    { code: 'E', name: 'عمر القضاة', phone: '0785551205', vehicleType: 'motorcycle', vehicleId: '22-31954', area: 'تلاع العلي', available: true, status: 'active', gpsMode: 'demo', stars: [5, 4, 4, 5], daysAgo: 110, targetJod: 18.5 },
    { code: 'F', name: 'فراس المجالي', phone: '0775551206', vehicleType: 'car', vehicleId: '13-28066', area: 'خلدا', available: true, status: 'active', gpsMode: 'demo', stars: [4, 4], daysAgo: 88, targetJod: 12 },
    { code: 'G', name: 'غيث الرواشدة', phone: '0795551207', vehicleType: 'motorcycle', vehicleId: '22-49921', area: 'جبل عمّان', available: true, status: 'active', gpsMode: 'demo', stars: [3, 4], daysAgo: 33, targetJod: 7 },
    { code: 'H', name: 'هاني السرحان', phone: '0785551208', vehicleType: 'van', vehicleId: '17-10485', area: 'طبربور', available: false, status: 'inactive', gpsMode: 'off', stars: [3], daysAgo: 140, targetJod: 3 },
  ]
  const captains: Captain[] = captainRows.map((r, i) => {
    const [lat, lng] = AREA_COORDS[r.area]
    return {
      id: `c${i + 1}`,
      code: r.code,
      name: r.name,
      phone: r.phone,
      vehicleType: r.vehicleType,
      vehicleId: r.vehicleId,
      status: r.status,
      available: r.available,
      gpsMode: r.gpsMode,
      gpsLost: false,
      lat: lat + 0.002 * ((i % 3) - 1),
      lng: lng + 0.0015 * ((i % 2) - 0.5),
      locationUpdatedAt: r.status === 'inactive' ? now - 3 * DAY : at(1),
      ratings: r.stars.map((stars, j) => ({
        id: `r${i + 1}_${j}`,
        stars,
        note: j === 0 ? 'تقييم دوري' : '',
        createdAt: now - (r.daysAgo - 10 * (j + 1)) * DAY,
      })),
      createdAt: now - r.daysAgo * DAY,
      username: `captain${r.code.toLowerCase()}`,
      password: 'demo1234',
    }
  })
  const cap = (code: string) => captains.find((c) => c.code === code)!

  type OrderRow = {
    merchant: number
    customerName: string
    customerPhone: string
    area: string
    street: string
    feeJod: number
    status: OrderStatus
    captain?: string
    /** minutes since creation */
    age: number
    privateTo?: string
    rejectedBy?: string
    instructions?: string
  }
  const orderRows: OrderRow[] = [
    { merchant: 0, customerName: 'هبة', customerPhone: '0790001101', area: 'دابوق', street: 'شارع الملكة نور، فيلا 12', feeJod: 2.5, status: 'delivered', captain: 'E', age: 300 },
    { merchant: 1, customerName: 'يزن', customerPhone: '0780001102', area: 'جبل عمّان', street: 'شارع الرينبو، بناية 3', feeJod: 1.5, status: 'delivered', captain: 'F', age: 250 },
    { merchant: 2, customerName: 'سلمى', customerPhone: '0770001103', area: 'الرابية', street: 'شارع عبدالله غوشة، 41', feeJod: 2, status: 'delivered', captain: 'C', age: 190 },
    { merchant: 4, customerName: 'معاذ', customerPhone: '0790001104', area: 'عبدون', street: 'شارع فيصل بن عبدالعزيز، 8', feeJod: 2.5, status: 'delivered', captain: 'A', age: 1500 },
    { merchant: 3, customerName: 'نور', customerPhone: '0780001105', area: 'تلاع العلي', street: 'شارع المدينة المنورة، 120', feeJod: 2, status: 'delivered', captain: 'B', age: 1620 },
    { merchant: 5, customerName: 'ريم', customerPhone: '0770001106', area: 'الصويفية', street: 'شارع الباعونية، 5', feeJod: 2, status: 'cancelled', age: 400, instructions: 'العميل ألغى الطلب' },
    { merchant: 0, customerName: 'طارق', customerPhone: '0790001107', area: 'خلدا', street: 'شارع عامر بن مالك، 17', feeJod: 3, status: 'cancelled', captain: 'G', age: 340 },
    { merchant: 0, customerName: 'لانا', customerPhone: '0780001108', area: 'الجبيهة', street: 'شارع ياجوز، عمارة 9', feeJod: 3, status: 'on_the_way', captain: 'E', age: 32, instructions: 'الرجاء الاتصال عند الوصول' },
    { merchant: 3, customerName: 'فادي', customerPhone: '0770001109', area: 'دابوق', street: 'شارع حسين حمدان، 3', feeJod: 2.5, status: 'picked_up', captain: 'F', age: 24 },
    { merchant: 4, customerName: 'جود', customerPhone: '0790001110', area: 'اللويبدة', street: 'شارع جبل اللويبدة، 26', feeJod: 1.5, status: 'heading_to_pickup', captain: 'G', age: 11 },
    { merchant: 1, customerName: 'عبدالله', customerPhone: '0780001111', area: 'الشميساني', street: 'شارع الثقافة، 14', feeJod: 2, status: 'awaiting_captain', age: 6, instructions: 'طلب قهوة – يرجى الحفاظ على الأكواب بشكل عمودي' },
    { merchant: 2, customerName: 'مي', customerPhone: '0770001112', area: 'أم أذينة', street: 'شارع سعد بن أبي وقاص، 30', feeJod: 1.5, status: 'awaiting_captain', age: 3 },
    { merchant: 5, customerName: 'زيد', customerPhone: '0790001113', area: 'مرج الحمام', street: 'شارع الأمير فيصل، 77', feeJod: 3.5, status: 'pending_dispatch', age: 18, rejectedBy: 'C', instructions: 'هدية – التعامل بعناية' },
    { merchant: 0, customerName: 'دانا', customerPhone: '0780001114', area: 'الرابية', street: 'شارع إبراهيم القطان، 6', feeJod: 2.5, status: 'offered_privately', privateTo: 'D', age: 2 },
    { merchant: 4, customerName: 'حمزة', customerPhone: '0770001115', area: 'طبربور', street: 'شارع طارق، 51', feeJod: 2, status: 'dispatch_expired', age: 26 },
  ]

  const PATH: Record<string, OrderStatus[]> = {
    delivered: ['awaiting_captain', 'accepted', 'heading_to_pickup', 'picked_up', 'on_the_way', 'delivered'],
    on_the_way: ['awaiting_captain', 'accepted', 'heading_to_pickup', 'picked_up', 'on_the_way'],
    picked_up: ['awaiting_captain', 'accepted', 'heading_to_pickup', 'picked_up'],
    heading_to_pickup: ['awaiting_captain', 'accepted', 'heading_to_pickup'],
    awaiting_captain: ['awaiting_captain'],
    pending_dispatch: ['pending_dispatch', 'offered_privately', 'pending_dispatch'],
    offered_privately: ['pending_dispatch', 'offered_privately'],
    dispatch_expired: ['pending_dispatch', 'offered_privately', 'dispatch_expired'],
  }

  const txs: WalletTx[] = []
  let txN = 0
  const tx = (captainId: string, type: WalletTx['type'], amount: number, orderId: string | null, note: string, createdAt: number) =>
    txs.push({ id: `t${++txN}`, captainId, type, amount, orderId, note, createdAt })

  let ref = 10231
  const orders: Order[] = orderRows.map((r, i) => {
    const m = merchants[r.merchant]
    const [dLat, dLng] = AREA_COORDS[r.area]
    const created = at(r.age)
    const id = `o${i + 1}`
    const captain = r.captain ? cap(r.captain) : null
    const fee = jodToFils(r.feeJod)

    let steps: OrderStatus[]
    if (r.status === 'cancelled') steps = captain ? ['awaiting_captain', 'accepted', 'cancelled'] : ['awaiting_captain', 'cancelled']
    else steps = PATH[r.status]
    const span = Math.min(r.age - 1, r.status === 'delivered' ? 38 : r.age)
    const timeline: TimelineEntry[] = [{ status: 'pending_dispatch', at: created, by: 'merchant', note: 'تم إنشاء الطلب' }]
    steps.forEach((s, k) => {
      if (k === 0 && s === 'pending_dispatch') return
      const by: Actor = ['awaiting_captain', 'dispatch_expired'].includes(s) ? 'system' : s === 'offered_privately' || s === 'cancelled' || s === 'pending_dispatch' ? 'admin' : 'captain'
      timeline.push({ status: s, at: created + Math.round(((k + 1) / steps.length) * span * MIN), by })
    })
    if (r.rejectedBy) {
      const idx = timeline.length - 1
      timeline[idx] = { ...timeline[idx], by: 'captain', note: `رفض الكابتن ${cap(r.rejectedBy).name} العرض الخاص` }
    }

    if (captain) {
      const acceptedAt = timeline.find((t) => t.status === 'accepted')!.at
      tx(captain.id, 'reservation', fee, id, `حجز رسوم الطلب SH-${ref}`, acceptedAt)
      if (r.status === 'delivered') tx(captain.id, 'debit', fee, id, `خصم رسوم توصيل SH-${ref}`, timeline[timeline.length - 1].at)
      if (r.status === 'cancelled') tx(captain.id, 'release', fee, id, `تحرير حجز بعد إلغاء SH-${ref}`, timeline[timeline.length - 1].at)
    }

    return {
      id,
      ref: `SH-${ref++}`,
      merchantId: m.id,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      dropoffAddress: `${r.area}، ${r.street}`,
      dropoffArea: r.area,
      dropoffLat: dLat + 0.0009 * ((i % 4) - 1.5),
      dropoffLng: dLng + 0.0011 * ((i % 3) - 1),
      locationNotes: '',
      pickupAddress: m.address,
      pickupArea: m.area,
      pickupLat: m.lat,
      pickupLng: m.lng,
      fee,
      instructions: r.instructions ?? '',
      merchantRef: i % 3 === 0 ? `INV-${4800 + i * 7}` : '',
      status: r.status,
      captainId: captain ? captain.id : null,
      privateCaptainId: r.privateTo ? cap(r.privateTo).id : null,
      privateOfferExpiresAt: r.privateTo ? now + 6 * MIN : null,
      pausedByBroadcast: false,
      dismissedBy: [],
      rejectedBy: r.rejectedBy ? [cap(r.rejectedBy).id] : [],
      timeline,
      createdAt: created,
      createdBy: 'merchant',
    }
  })

  // Place busy captains along their routes
  for (const o of orders) {
    if (!o.captainId || !['on_the_way', 'picked_up', 'heading_to_pickup'].includes(o.status)) continue
    const c = captains.find((x) => x.id === o.captainId)!
    const towardDrop = o.status !== 'heading_to_pickup'
    const f = o.status === 'on_the_way' ? 0.55 : o.status === 'picked_up' ? 0.05 : 0.4
    const [fromLat, fromLng] = towardDrop ? [o.pickupLat, o.pickupLng] : [c.lat, c.lng]
    const [toLat, toLng] = towardDrop ? [o.dropoffLat, o.dropoffLng] : [o.pickupLat, o.pickupLng]
    c.lat = fromLat + (toLat - fromLat) * f
    c.lng = fromLng + (toLng - fromLng) * f
  }

  // Recharges sized so each captain lands exactly on their target available balance.
  // available = recharges − reservations + releases  (debits consume reservations)
  for (const r of captainRows) {
    const c = cap(r.code)
    const own = txs.filter((t) => t.captainId === c.id)
    const held = own.filter((t) => t.type === 'reservation').reduce((s, t) => s + t.amount, 0)
    const freed = own.filter((t) => t.type === 'release').reduce((s, t) => s + t.amount, 0)
    const needed = jodToFils(r.targetJod) + held - freed
    if (needed <= 0) continue
    const first = Math.round(needed * 0.6 / 500) * 500
    if (first > 0 && first < needed) {
      tx(c.id, 'recharge', first, null, 'شحن رصيد من الإدارة', now - (r.daysAgo - 2) * DAY)
      tx(c.id, 'recharge', needed - first, null, 'شحن رصيد من الإدارة', now - 2 * DAY - 3 * HOUR)
    } else {
      tx(c.id, 'recharge', needed, null, 'شحن رصيد من الإدارة', now - (r.daysAgo - 2) * DAY)
    }
  }
  txs.sort((a, b) => a.createdAt - b.createdAt)

  const dailyStats: DailyStat[] = [
    { daysAgo: 6, created: 18, delivered: 16 },
    { daysAgo: 5, created: 22, delivered: 20 },
    { daysAgo: 4, created: 19, delivered: 18 },
    { daysAgo: 3, created: 25, delivered: 23 },
    { daysAgo: 2, created: 27, delivered: 25 },
    { daysAgo: 1, created: 21, delivered: 19 },
  ]

  return {
    merchants,
    captains,
    orders,
    txs,
    settings: { publicBroadcasting: true, privateOfferTtlMin: 5, autoSimulateMovement: true },
    dailyStats,
    nextRef: ref,
  }
}
