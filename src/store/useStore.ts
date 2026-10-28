import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, type SeedState } from '../lib/seed'
import {
  CAPTAIN_NEXT,
  UNASSIGNED,
  activeOrderOf,
  availabilityBlockers,
  canTransition,
  gpsHealthy,
  orderBlockers,
  reservationState,
  stepToward,
} from '../lib/rules'
import type {
  Actor,
  Captain,
  Fils,
  GpsMode,
  Merchant,
  Order,
  OrderStatus,
  Result,
  Session,
  WalletTx,
} from '../lib/types'

let seq = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 5)}`

const ok: Result = { ok: true }
const fail = (error: string): Result => ({ ok: false, error })

export const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin1234' }

export type MerchantInput = Omit<Merchant, 'id' | 'createdAt' | 'status'>
export type CaptainInput = Pick<Captain, 'name' | 'phone' | 'vehicleType' | 'vehicleId' | 'username' | 'password' | 'lat' | 'lng'>

export interface OrderInput {
  merchantId: string
  customerName: string
  customerPhone: string
  dropoffAddress: string
  dropoffArea: string
  dropoffLat: number
  dropoffLng: number
  locationNotes: string
  fee: Fils
  instructions: string
  merchantRef: string
}

/** How an admin-created order should be dispatched */
export type DispatchChoice = { mode: 'public' } | { mode: 'queue' } | { mode: 'private'; captainId: string }

interface State extends SeedState {
  session: Session | null
  /** Captain picked by the presenter for the captain view */
  demoCaptainId: string
  /** Last time the demo was seeded */
  seededAt: number
}

interface Actions {
  login: (role: Session['role'], id?: string) => void
  loginWithCredentials: (username: string, password: string) => Result & { session?: Session }
  logout: () => void
  resetDemo: () => void

  addMerchant: (input: MerchantInput) => Result & { id?: string }
  updateMerchant: (id: string, patch: Partial<MerchantInput>) => Result
  setMerchantStatus: (id: string, status: Merchant['status']) => Result

  addCaptain: (input: CaptainInput, initialRechargeFils: Fils) => Result & { id?: string }
  updateCaptain: (id: string, patch: Partial<CaptainInput>) => Result
  setCaptainStatus: (id: string, status: Captain['status']) => Result
  rateCaptain: (id: string, stars: number, note: string) => Result
  rechargeWallet: (captainId: string, amount: Fils, note: string) => Result

  createOrder: (input: OrderInput, by: Actor, dispatch?: DispatchChoice) => Result & { id?: string; ref?: string }
  setBroadcasting: (on: boolean) => Result & { moved?: number }
  broadcastOrder: (orderId: string) => Result
  offerPrivately: (orderId: string, captainId: string) => Result
  cancelOrder: (orderId: string, by: Actor, reason?: string) => Result

  dismissOffer: (orderId: string, captainId: string) => Result
  acceptOrder: (orderId: string, captainId: string) => Result
  rejectPrivate: (orderId: string, captainId: string) => Result
  advanceOrder: (orderId: string, captainId: string) => Result & { status?: OrderStatus; note?: string }

  setAvailability: (captainId: string, on: boolean) => Result
  setGpsMode: (captainId: string, mode: GpsMode) => void
  setGpsLost: (captainId: string, lost: boolean) => void
  updateLocation: (captainId: string, lat: number, lng: number) => void
  simulateGpsStep: (captainId: string) => Result
  setDemoCaptain: (captainId: string) => void
  setSetting: <K extends keyof State['settings']>(key: K, value: State['settings'][K]) => void
  expirePrivateOffer: (orderId: string) => Result

  tick: (now: number) => void
}

export type Store = State & Actions

const initial = (): State => {
  const seed = buildSeed()
  return { ...seed, session: null, demoCaptainId: seed.captains.find((c) => c.code === 'D')!.id, seededAt: Date.now() }
}

function withStatus(o: Order, to: OrderStatus, by: Actor, note?: string, now = Date.now()): Order {
  if (!canTransition(o.status, to)) throw new Error(`invalid transition ${o.status} → ${to}`)
  return { ...o, status: to, timeline: [...o.timeline, { status: to, at: now, by, note }] }
}

function newTx(captainId: string, type: WalletTx['type'], amount: Fils, orderId: string | null, note: string): WalletTx {
  return { id: uid('t'), captainId, type, amount, orderId, note, createdAt: Date.now() }
}

/** Movement target for a captain on an active delivery (null when idle). */
function targetFor(c: Captain, orders: Order[]): [number, number] | null {
  const o = activeOrderOf(orders, c.id)
  if (!o) return null
  if (o.status === 'accepted' || o.status === 'heading_to_pickup') return [o.pickupLat, o.pickupLng]
  return [o.dropoffLat, o.dropoffLng]
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const patchOrder = (id: string, fn: (o: Order) => Order) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? fn(o) : o)) }))
      const patchCaptain = (id: string, patch: Partial<Captain>) =>
        set((s) => ({ captains: s.captains.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

      return {
        ...initial(),

        // ---------------- session ----------------
        login: (role, id) => {
          const s = get()
          if (role === 'admin') set({ session: { role, merchantId: null, captainId: null } })
          if (role === 'merchant') set({ session: { role, merchantId: id ?? s.merchants[0].id, captainId: null } })
          if (role === 'captain') {
            const captainId = id ?? s.demoCaptainId
            set({ session: { role, merchantId: null, captainId }, demoCaptainId: captainId })
          }
        },
        loginWithCredentials: (username, password) => {
          const s = get()
          const u = username.trim().toLowerCase()
          if (u === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            get().login('admin')
            return { ...ok, session: get().session! }
          }
          const m = s.merchants.find((x) => x.username.toLowerCase() === u && x.password === password)
          if (m) {
            if (m.status !== 'active') return fail('حساب التاجر موقوف. يرجى التواصل مع الإدارة.')
            get().login('merchant', m.id)
            return { ...ok, session: get().session! }
          }
          const c = s.captains.find((x) => x.username.toLowerCase() === u && x.password === password)
          if (c) {
            get().login('captain', c.id)
            return { ...ok, session: get().session! }
          }
          return fail('اسم المستخدم أو كلمة المرور غير صحيحة.')
        },
        logout: () => set({ session: null }),
        resetDemo: () => {
          const session = get().session
          const fresh = initial()
          // Keep the presenter in a valid seeded session after reset
          let next: Session | null = null
          if (session?.role === 'admin') next = session
          if (session?.role === 'merchant') next = { ...session, merchantId: fresh.merchants[0].id }
          if (session?.role === 'captain') next = { ...session, captainId: fresh.demoCaptainId }
          set({ ...fresh, session: next })
        },

        // ---------------- merchants ----------------
        addMerchant: (input) => {
          const s = get()
          if (s.merchants.some((m) => m.username.toLowerCase() === input.username.toLowerCase()) || s.captains.some((c) => c.username.toLowerCase() === input.username.toLowerCase()))
            return fail('اسم المستخدم مستخدم مسبقاً.')
          const m: Merchant = { ...input, id: uid('m'), status: 'active', createdAt: Date.now() }
          set({ merchants: [m, ...s.merchants] })
          return { ...ok, id: m.id }
        },
        updateMerchant: (id, patch) => {
          const s = get()
          if (patch.username && s.merchants.some((m) => m.id !== id && m.username.toLowerCase() === patch.username!.toLowerCase()))
            return fail('اسم المستخدم مستخدم مسبقاً.')
          set({ merchants: s.merchants.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
          return ok
        },
        setMerchantStatus: (id, status) => {
          set((s) => ({ merchants: s.merchants.map((m) => (m.id === id ? { ...m, status } : m)) }))
          return ok
        },

        // ---------------- captains ----------------
        addCaptain: (input, initialRechargeFils) => {
          const s = get()
          const uname = input.username.toLowerCase()
          if (s.captains.some((c) => c.username.toLowerCase() === uname) || s.merchants.some((m) => m.username.toLowerCase() === uname))
            return fail('اسم المستخدم مستخدم مسبقاً.')
          const used = new Set(s.captains.map((c) => c.code))
          let code = ''
          for (let i = 0; !code; i++) {
            const candidate = i < 26 ? String.fromCharCode(65 + i) : `C${i}`
            if (!used.has(candidate)) code = candidate
          }
          const c: Captain = {
            ...input,
            id: uid('c'),
            code,
            status: 'active',
            available: false,
            gpsMode: 'demo',
            gpsLost: false,
            locationUpdatedAt: Date.now(),
            ratings: [],
            createdAt: Date.now(),
          }
          const txs = initialRechargeFils > 0 ? [...s.txs, newTx(c.id, 'recharge', initialRechargeFils, null, 'شحن رصيد افتتاحي من الإدارة (تجريبي)')] : s.txs
          set({ captains: [...s.captains, c], txs })
          return { ...ok, id: c.id }
        },
        updateCaptain: (id, patch) => {
          const s = get()
          if (patch.username && s.captains.some((c) => c.id !== id && c.username.toLowerCase() === patch.username!.toLowerCase()))
            return fail('اسم المستخدم مستخدم مسبقاً.')
          patchCaptain(id, patch)
          return ok
        },
        setCaptainStatus: (id, status) => {
          patchCaptain(id, status === 'inactive' ? { status, available: false } : { status })
          return ok
        },
        rateCaptain: (id, stars, note) => {
          if (stars < 1 || stars > 5) return fail('اختر تقييماً من 1 إلى 5 نجوم.')
          const c = get().captains.find((x) => x.id === id)
          if (!c) return fail('الكابتن غير موجود.')
          patchCaptain(id, { ratings: [...c.ratings, { id: uid('r'), stars, note: note.trim(), createdAt: Date.now() }] })
          return ok
        },
        rechargeWallet: (captainId, amount, note) => {
          if (!Number.isInteger(amount) || amount <= 0) return fail('أدخل مبلغاً موجباً صحيحاً.')
          if (!get().captains.some((c) => c.id === captainId)) return fail('الكابتن غير موجود.')
          set((s) => ({ txs: [...s.txs, newTx(captainId, 'recharge', amount, null, note.trim() || 'شحن رصيد من الإدارة (تجريبي)')] }))
          return ok
        },

        // ---------------- orders: dispatch ----------------
        createOrder: (input, by, dispatch) => {
          const s = get()
          const m = s.merchants.find((x) => x.id === input.merchantId)
          if (!m) return fail('التاجر غير موجود.')
          if (m.status !== 'active') return fail('حساب التاجر موقوف ولا يمكنه إنشاء طلبات.')
          if (!Number.isInteger(input.fee) || input.fee <= 0) return fail('رسوم التوصيل يجب أن تكون أكبر من صفر.')
          const now = Date.now()
          const ref = `SH-${s.nextRef}`
          let order: Order = {
            ...input,
            id: uid('o'),
            ref,
            pickupAddress: m.address,
            pickupArea: m.area,
            pickupLat: m.lat,
            pickupLng: m.lng,
            status: 'pending_dispatch',
            captainId: null,
            privateCaptainId: null,
            privateOfferExpiresAt: null,
            pausedByBroadcast: false,
            dismissedBy: [],
            rejectedBy: [],
            timeline: [{ status: 'pending_dispatch', at: now, by, note: 'تم إنشاء الطلب' }],
            createdAt: now,
            createdBy: by,
          }
          const choice: DispatchChoice = dispatch ?? { mode: 'public' }
          if (choice.mode === 'private') {
            const c = s.captains.find((x) => x.id === choice.captainId)
            if (!c) return fail('الكابتن غير موجود.')
            const blockers = orderBlockers(c, order, s.orders, s.txs)
            if (blockers.length) return fail(`الكابتن غير مؤهل: ${blockers.join('، ')}`)
            order = withStatus(order, 'offered_privately', 'admin', `عرض حصري للكابتن ${c.name}`, now)
            order.privateCaptainId = c.id
            order.privateOfferExpiresAt = now + s.settings.privateOfferTtlMin * 60_000
          } else if (choice.mode === 'public') {
            if (s.settings.publicBroadcasting) order = withStatus(order, 'awaiting_captain', 'system', 'تم نشر الطلب للكباتن المؤهلين', now)
            else order = { ...order, pausedByBroadcast: true, timeline: [...order.timeline, { status: 'pending_dispatch', at: now, by: 'system', note: 'البث العام متوقف – بانتظار توجيه الإدارة' }] }
          }
          set({ orders: [order, ...s.orders], nextRef: s.nextRef + 1 })
          return { ...ok, id: order.id, ref }
        },

        setBroadcasting: (on) => {
          const s = get()
          const now = Date.now()
          let moved = 0
          const orders = s.orders.map((o) => {
            if (!on && o.status === 'awaiting_captain') {
              moved++
              return { ...withStatus(o, 'pending_dispatch', 'system', 'إيقاف البث العام – نُقل إلى قائمة الانتظار', now), pausedByBroadcast: true }
            }
            if (on && o.status === 'pending_dispatch' && o.pausedByBroadcast) {
              moved++
              return { ...withStatus(o, 'awaiting_captain', 'system', 'استئناف البث العام', now), pausedByBroadcast: false }
            }
            return o
          })
          set({ orders, settings: { ...s.settings, publicBroadcasting: on } })
          return { ...ok, moved }
        },

        broadcastOrder: (orderId) => {
          const s = get()
          if (!s.settings.publicBroadcasting) return fail('البث العام متوقف. فعّله من الإعدادات أو استخدم التوجيه الخاص.')
          const o = s.orders.find((x) => x.id === orderId)
          if (!o || !canTransition(o.status, 'awaiting_captain')) return fail('لا يمكن نشر هذا الطلب في حالته الحالية.')
          patchOrder(orderId, (x) => ({ ...withStatus(x, 'awaiting_captain', 'admin', 'نشر الطلب للكباتن من قبل الإدارة'), pausedByBroadcast: false, dismissedBy: [], privateCaptainId: null, privateOfferExpiresAt: null }))
          return ok
        },

        offerPrivately: (orderId, captainId) => {
          const s = get()
          const o = s.orders.find((x) => x.id === orderId)
          const c = s.captains.find((x) => x.id === captainId)
          if (!o || !c) return fail('الطلب أو الكابتن غير موجود.')
          if (!canTransition(o.status, 'offered_privately')) return fail('لا يمكن توجيه هذا الطلب في حالته الحالية.')
          const blockers = orderBlockers(c, o, s.orders, s.txs)
          if (blockers.length) return fail(`الكابتن غير مؤهل: ${blockers.join('، ')}`)
          patchOrder(orderId, (x) => ({
            ...withStatus(x, 'offered_privately', 'admin', `عرض حصري للكابتن ${c.name}`),
            privateCaptainId: c.id,
            privateOfferExpiresAt: Date.now() + s.settings.privateOfferTtlMin * 60_000,
            pausedByBroadcast: false,
          }))
          return ok
        },

        cancelOrder: (orderId, by, reason) => {
          const s = get()
          const o = s.orders.find((x) => x.id === orderId)
          if (!o) return fail('الطلب غير موجود.')
          if (!canTransition(o.status, 'cancelled')) return fail('لا يمكن إلغاء الطلب في حالته الحالية.')
          if (by === 'merchant' && !UNASSIGNED.includes(o.status)) return fail('تم تعيين كابتن للطلب. تواصل مع الإدارة للإلغاء.')
          let txs = s.txs
          if (o.captainId && reservationState(s.txs, o.id) === 'reserved')
            txs = [...txs, newTx(o.captainId, 'release', o.fee, o.id, `تحرير حجز بعد إلغاء ${o.ref}`)]
          set({
            txs,
            orders: s.orders.map((x) =>
              x.id === orderId ? { ...withStatus(x, 'cancelled', by, reason || undefined), privateCaptainId: null, privateOfferExpiresAt: null } : x,
            ),
          })
          return ok
        },

        // ---------------- orders: captain ----------------
        dismissOffer: (orderId, captainId) => {
          const o = get().orders.find((x) => x.id === orderId)
          if (!o) return fail('الطلب غير موجود.')
          if (o.status === 'offered_privately' && o.privateCaptainId === captainId) return get().rejectPrivate(orderId, captainId)
          patchOrder(orderId, (x) => ({ ...x, dismissedBy: [...new Set([...x.dismissedBy, captainId])] }))
          return ok
        },

        acceptOrder: (orderId, captainId) => {
          // Single synchronous read-check-write against the in-memory store (demo only,
          // not a substitute for server-side transactional locking).
          const s = get()
          const o = s.orders.find((x) => x.id === orderId)
          const c = s.captains.find((x) => x.id === captainId)
          if (!o || !c) return fail('الطلب غير موجود.')
          if (o.captainId && o.captainId !== captainId) return fail('تم قبول هذا الطلب من كابتن آخر.')
          const isPrivateForMe = o.status === 'offered_privately' && o.privateCaptainId === captainId
          if (o.status !== 'awaiting_captain' && !isPrivateForMe) return fail('هذا الطلب لم يعد متاحاً.')
          const blockers = orderBlockers(c, o, s.orders, s.txs)
          if (blockers.length) return fail(`لا يمكنك قبول الطلب: ${blockers.join('، ')}`)
          const txs = reservationState(s.txs, o.id) === 'none' ? [...s.txs, newTx(captainId, 'reservation', o.fee, o.id, `حجز رسوم الطلب ${o.ref}`)] : s.txs
          set({
            txs,
            orders: s.orders.map((x) =>
              x.id === orderId
                ? { ...withStatus(x, 'accepted', 'captain', `قبول الكابتن ${c.name}`), captainId, privateCaptainId: null, privateOfferExpiresAt: null, pausedByBroadcast: false }
                : x,
            ),
          })
          return ok
        },

        rejectPrivate: (orderId, captainId) => {
          const s = get()
          const o = s.orders.find((x) => x.id === orderId)
          const c = s.captains.find((x) => x.id === captainId)
          if (!o || !c || o.status !== 'offered_privately' || o.privateCaptainId !== captainId) return fail('العرض لم يعد متاحاً.')
          patchOrder(orderId, (x) => ({
            ...withStatus(x, 'pending_dispatch', 'captain', `رفض الكابتن ${c.name} العرض الخاص – أُعيد إلى قائمة الإدارة`),
            privateCaptainId: null,
            privateOfferExpiresAt: null,
            pausedByBroadcast: false,
            rejectedBy: [...new Set([...x.rejectedBy, captainId])],
          }))
          return ok
        },

        advanceOrder: (orderId, captainId) => {
          const s = get()
          const o = s.orders.find((x) => x.id === orderId)
          if (!o || o.captainId !== captainId) return fail('هذا الطلب غير مسند إليك.')
          const next = CAPTAIN_NEXT[o.status]
          if (!next) return fail('لا توجد مرحلة تالية لهذا الطلب.')
          let txs = s.txs
          let captains = s.captains
          let note: string | undefined
          if (next === 'delivered') {
            // Convert the reservation into a final debit exactly once
            if (reservationState(s.txs, o.id) === 'reserved') txs = [...txs, newTx(captainId, 'debit', o.fee, o.id, `خصم رسوم توصيل ${o.ref}`)]
            const c = s.captains.find((x) => x.id === captainId)!
            const ordersAfter = s.orders.map((x) => (x.id === orderId ? { ...x, status: 'delivered' as const } : x))
            const blockers = availabilityBlockers(c, ordersAfter, txs)
            if (c.available && blockers.length) {
              captains = s.captains.map((x) => (x.id === captainId ? { ...x, available: false } : x))
              note = `تم تحويل حالتك إلى غير متاح: ${blockers[0]}`
            }
          }
          set({ txs, captains, orders: s.orders.map((x) => (x.id === orderId ? withStatus(x, next, 'captain') : x)) })
          return { ...ok, status: next, note }
        },

        // ---------------- captain presence ----------------
        setAvailability: (captainId, on) => {
          const s = get()
          const c = s.captains.find((x) => x.id === captainId)
          if (!c) return fail('الكابتن غير موجود.')
          if (on) {
            const blockers = availabilityBlockers(c, s.orders, s.txs)
            if (blockers.length) return fail(blockers[0])
          }
          patchCaptain(captainId, { available: on })
          return ok
        },
        setGpsMode: (captainId, mode) =>
          patchCaptain(captainId, mode === 'off' ? { gpsMode: mode, available: false } : { gpsMode: mode, gpsLost: false, locationUpdatedAt: Date.now() }),
        setGpsLost: (captainId, lost) => patchCaptain(captainId, lost ? { gpsLost: true } : { gpsLost: false, locationUpdatedAt: Date.now() }),
        updateLocation: (captainId, lat, lng) => patchCaptain(captainId, { lat, lng, locationUpdatedAt: Date.now() }),
        simulateGpsStep: (captainId) => {
          const s = get()
          const c = s.captains.find((x) => x.id === captainId)
          if (!c) return fail('الكابتن غير موجود.')
          if (!gpsHealthy(c)) return fail('إشارة الموقع مفقودة – لا يمكن تحديث الموقع.')
          const target = targetFor(c, s.orders)
          const p = target ? stepToward(c.lat, c.lng, target[0], target[1], 0.45) : { lat: c.lat + 0.0015, lng: c.lng - 0.001 }
          patchCaptain(captainId, { ...p, locationUpdatedAt: Date.now() })
          return ok
        },
        setDemoCaptain: (captainId) => {
          const s = get()
          set({ demoCaptainId: captainId, session: s.session?.role === 'captain' ? { ...s.session, captainId } : s.session })
        },
        setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
        expirePrivateOffer: (orderId) => {
          const o = get().orders.find((x) => x.id === orderId)
          if (!o || o.status !== 'offered_privately') return fail('لا يوجد عرض خاص نشط لهذا الطلب.')
          patchOrder(orderId, (x) => ({ ...withStatus(x, 'dispatch_expired', 'system', 'انتهت مهلة العرض الخاص – أُعيد إلى قائمة الإدارة'), privateCaptainId: null, privateOfferExpiresAt: null }))
          return ok
        },

        // ---------------- background simulation ----------------
        tick: (now) => {
          const s = get()
          let changed = false
          const orders = s.orders.map((o) => {
            if (o.status === 'offered_privately' && o.privateOfferExpiresAt && o.privateOfferExpiresAt <= now) {
              changed = true
              return { ...withStatus(o, 'dispatch_expired', 'system', 'انتهت مهلة العرض الخاص – أُعيد إلى قائمة الإدارة', now), privateCaptainId: null, privateOfferExpiresAt: null }
            }
            return o
          })
          let captains = s.captains
          if (s.settings.autoSimulateMovement) {
            captains = s.captains.map((c) => {
              // Only simulated ("demo") captains with a healthy signal move; browser-GPS captains move via the real API.
              if (c.gpsMode !== 'demo' || c.gpsLost || c.status !== 'active') return c
              const target = targetFor(c, orders)
              const o = activeOrderOf(orders, c.id)
              if (target && o && (o.status === 'heading_to_pickup' || o.status === 'on_the_way')) {
                changed = true
                return { ...c, ...stepToward(c.lat, c.lng, target[0], target[1], 0.08), locationUpdatedAt: now }
              }
              if (c.available || o) {
                changed = true
                return { ...c, locationUpdatedAt: now }
              }
              return c
            })
          }
          if (changed) set({ orders, captains })
        },
      }
    },
    {
      name: 'shahm-demo-v1',
      version: 1,
    },
  ),
)
