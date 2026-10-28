// Headless check of the demo scenarios against the real store and business rules.
// Run: npx tsx scripts/scenarios.test.ts
import assert from 'node:assert/strict'
import { useStore } from '../src/store/useStore'
import { feedFor, walletOf, reservationState } from '../src/lib/rules'
import { jodToFils } from '../src/lib/format'

const S = () => useStore.getState()
const cap = (code: string) => S().captains.find((c) => c.code === code)!
const feed = (code: string) => feedFor(cap(code), S().orders, S().txs)
const avail = (id: string) => walletOf(S().txs, id).available
const order = (id: string) => S().orders.find((o) => o.id === id)!
let passed = 0
const check = (name: string, fn: () => void) => {
  fn()
  passed++
  console.log('✓', name)
}

S().resetDemo()

check('seed: 6 merchants, 8 captains, 15 orders', () => {
  assert.equal(S().merchants.length, 6)
  assert.equal(S().captains.length, 8)
  assert.equal(S().orders.length, 15)
})

check('seed balances A=0, B=1, C=5, D=10 JOD', () => {
  assert.equal(avail(cap('A').id), 0)
  assert.equal(avail(cap('B').id), 1000)
  assert.equal(avail(cap('C').id), 5000)
  assert.equal(avail(cap('D').id), 10000)
})

check('wallet eligibility: A sees nothing, B misses the 2 JOD order, C sees it', () => {
  const twoJod = S().orders.find((o) => o.status === 'awaiting_captain' && o.fee === 2000)!
  assert.equal(feed('A').length, 0)
  assert.ok(!feed('B').some((o) => o.id === twoJod.id))
  assert.ok(feed('C').some((o) => o.id === twoJod.id))
})

check('private offer is visible only to the chosen captain', () => {
  const priv = S().orders.find((o) => o.status === 'offered_privately')!
  assert.ok(feed('D').some((o) => o.id === priv.id))
  assert.ok(!feed('C').some((o) => o.id === priv.id))
})

// Scenario B
check('Scenario B: recharge makes zero-balance captain eligible', () => {
  const a = cap('A')
  assert.equal(S().setAvailability(a.id, true).ok, false)
  assert.equal(S().rechargeWallet(a.id, -5, '').ok, false)
  assert.ok(S().rechargeWallet(a.id, jodToFils(5), '').ok)
  assert.ok(feed('A').length > 0)
})

// Scenario A
check('Scenario A: full standard delivery lifecycle', () => {
  const m = S().addMerchant({ name: 'مطعم تجربة', category: 'مطعم', ownerName: 'تجربة', phone: '0791112223', address: 'عبدون، 1', area: 'عبدون', lat: 31.94, lng: 35.89, username: 'testm', password: 'demo1234' })
  assert.ok(m.ok)
  const c = S().addCaptain({ name: 'كابتن تجربة', phone: '0791112224', vehicleType: 'car', vehicleId: '11-111', username: 'testc', password: 'demo1234', lat: 31.95, lng: 35.9 }, 0)
  assert.ok(c.ok)
  assert.ok(S().rechargeWallet(c.id!, jodToFils(10), '').ok)
  assert.ok(S().setAvailability(c.id!, true).ok)
  const o = S().createOrder({ merchantId: m.id!, customerName: '', customerPhone: '0790000000', dropoffAddress: 'x', dropoffArea: 'خلدا', dropoffLat: 31.99, dropoffLng: 35.84, locationNotes: '', fee: 2000, instructions: '', merchantRef: '' }, 'merchant')
  assert.equal(order(o.id!).status, 'awaiting_captain')
  assert.ok(feedFor(S().captains.find((x) => x.id === c.id)!, S().orders, S().txs).some((x) => x.id === o.id))
  assert.ok(S().acceptOrder(o.id!, c.id!).ok)
  assert.equal(avail(c.id!), 8000)
  assert.equal(walletOf(S().txs, c.id!).reserved, 2000)
  // Another captain cannot take it
  assert.equal(S().acceptOrder(o.id!, cap('C').id).ok, false)
  assert.ok(!feed('C').some((x) => x.id === o.id))
  for (const s of ['heading_to_pickup', 'picked_up', 'on_the_way', 'delivered']) {
    const r = S().advanceOrder(o.id!, c.id!)
    assert.equal(r.status, s)
  }
  assert.equal(S().advanceOrder(o.id!, c.id!).ok, false) // no double completion
  assert.equal(S().txs.filter((t) => t.orderId === o.id && t.type === 'debit').length, 1)
  const w = walletOf(S().txs, c.id!)
  assert.deepEqual([w.available, w.reserved, w.total], [8000, 0, 8000])
})

// Scenario C
check('Scenario C: broadcasting off → queue → private dispatch → reject returns to queue', () => {
  const r = S().setBroadcasting(false)
  assert.ok((r.moved ?? 0) > 0)
  assert.equal(S().orders.filter((o) => o.status === 'awaiting_captain').length, 0)
  const merchant = S().merchants[1]
  const o = S().createOrder({ merchantId: merchant.id, customerName: '', customerPhone: '0790000001', dropoffAddress: 'x', dropoffArea: 'خلدا', dropoffLat: 31.99, dropoffLng: 35.84, locationNotes: '', fee: 2000, instructions: '', merchantRef: '' }, 'merchant')
  assert.equal(order(o.id!).status, 'pending_dispatch')
  assert.equal(feed('C').length, 0)
  // ineligible captain rejected
  assert.equal(S().offerPrivately(o.id!, cap('B').id).ok, false)
  assert.ok(S().offerPrivately(o.id!, cap('C').id).ok)
  assert.ok(feed('C').some((x) => x.id === o.id))
  assert.ok(!feed('D').some((x) => x.id === o.id))
  assert.ok(S().rejectPrivate(o.id!, cap('C').id).ok)
  assert.equal(order(o.id!).status, 'pending_dispatch')
  assert.equal(order(o.id!).pausedByBroadcast, false)
  // expiry path
  assert.ok(S().offerPrivately(o.id!, cap('D').id).ok)
  S().tick(Date.now() + 60 * 60 * 1000)
  assert.equal(order(o.id!).status, 'dispatch_expired')
  // restoring broadcast republishes only orders paused by the switch
  S().setBroadcasting(true)
  assert.equal(order(o.id!).status, 'dispatch_expired')
  assert.ok(S().orders.some((x) => x.status === 'awaiting_captain'))
})

check('cancellation releases reservation exactly once', () => {
  const o = S().orders.find((x) => x.status === 'awaiting_captain')!
  const d = cap('D')
  const before = avail(d.id)
  assert.ok(S().acceptOrder(o.id, d.id).ok)
  assert.equal(avail(d.id), before - o.fee)
  assert.ok(S().cancelOrder(o.id, 'admin').ok)
  assert.equal(S().cancelOrder(o.id, 'admin').ok, false)
  assert.equal(avail(d.id), before)
  assert.equal(reservationState(S().txs, o.id), 'released')
})

// Scenario D
check('Scenario D: GPS loss hides offers, delivery can continue after reconnect', () => {
  const e = cap('E')
  S().setGpsLost(e.id, true)
  assert.equal(S().simulateGpsStep(e.id).ok, false)
  S().setGpsLost(e.id, false)
  assert.ok(S().simulateGpsStep(e.id).ok)
  const active = S().orders.find((o) => o.captainId === e.id && o.status === 'on_the_way')!
  assert.equal(S().advanceOrder(active.id, e.id).status, 'delivered')
})

check('merchant cannot cancel after captain assignment', () => {
  const o = S().orders.find((x) => x.status === 'picked_up')!
  assert.equal(S().cancelOrder(o.id, 'merchant').ok, false)
})

check('reset restores seed', () => {
  S().resetDemo()
  assert.equal(S().orders.length, 15)
  assert.equal(avail(cap('A').id), 0)
})

console.log(`\n${passed} checks passed`)
