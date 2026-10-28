import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bike, Info, Package, Store } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Card, Switch } from '../../components/ui'
import { GpsIndicator, PRESENCE, PresenceBadge, SimulatedTag, captainPresence } from '../../components/shared'
import { MapLegend, MapView, type MapMarker, type MarkerKind } from '../../components/MapView'
import { STATUS_LABEL, money, relative } from '../../lib/format'
import { activeOrderOf, isActiveDelivery, locationIsStale, walletOf } from '../../lib/rules'
import { useNow } from '../../lib/useNow'
import { cn } from '../../lib/cn'

export default function LiveMap() {
  const { captains, merchants, orders, txs } = useStore()
  const now = useNow(4000)
  const [params, setParams] = useSearchParams()
  const selected = params.get('captain')
  const [layers, setLayers] = useState({ captains: true, merchants: true, deliveries: true })
  const sel = captains.find((c) => c.id === selected)

  const kindFor = (cid: string): MarkerKind => {
    const c = captains.find((x) => x.id === cid)!
    const p = captainPresence(c, orders)
    if (p === 'inactive' || p === 'offline') return 'offline'
    if (locationIsStale(c, now)) return 'stale'
    return p === 'busy' ? 'busy' : 'available'
  }

  const markers: MapMarker[] = []
  if (layers.merchants)
    merchants.forEach((m) => markers.push({ id: m.id, lat: m.lat, lng: m.lng, kind: 'merchant', popup: <div><b>{m.name}</b><div className="text-xs text-slate-500">{m.address}</div></div> }))
  if (layers.deliveries)
    orders.filter(isActiveDelivery).forEach((o) => {
      markers.push({ id: `${o.id}p`, lat: o.pickupLat, lng: o.pickupLng, kind: 'pickup', popup: <div><b>استلام {o.ref}</b><div className="text-xs">{o.pickupAddress}</div></div> })
      markers.push({ id: `${o.id}d`, lat: o.dropoffLat, lng: o.dropoffLng, kind: 'dropoff', popup: <div><b>تسليم {o.ref}</b><div className="text-xs">{o.dropoffAddress}</div></div> })
    })
  if (layers.captains)
    captains.forEach((c) => {
      const o = activeOrderOf(orders, c.id)
      markers.push({
        id: c.id,
        lat: c.lat,
        lng: c.lng,
        kind: kindFor(c.id),
        label: c.code,
        popup: (
          <div className="min-w-48 space-y-1 text-xs">
            <div className="text-sm font-semibold">{c.name}</div>
            <div>الحالة: <b>{PRESENCE[captainPresence(c, orders)].label}</b></div>
            <div>الرصيد المتاح: <b>{money(walletOf(txs, c.id).available)}</b></div>
            <div>الطلب المسند: <b>{o ? `${o.ref} · ${STATUS_LABEL[o.status]}` : 'لا يوجد'}</b></div>
            <div>آخر تحديث للموقع: <b>{relative(c.locationUpdatedAt, now)}</b></div>
            <div className="text-slate-500">{c.gpsMode === 'browser' ? 'المصدر: موقع الجهاز' : c.gpsMode === 'demo' ? 'المصدر: موقع تجريبي (محاكاة)' : 'المصدر: آخر موقع معروف'}</div>
          </div>
        ),
      })
    })

  const routes = layers.deliveries
    ? orders.filter(isActiveDelivery).map((o) => ({ points: [[o.pickupLat, o.pickupLng], [o.dropoffLat, o.dropoffLng]] as [number, number][], dashed: true, color: '#64748B' }))
    : []

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MapLegend items={[{ kind: 'available', label: 'كابتن متاح' }, { kind: 'busy', label: 'في توصيلة' }, { kind: 'offline', label: 'غير متاح (آخر موقع)' }, { kind: 'stale', label: 'موقع قديم / إشارة مفقودة' }, { kind: 'merchant', label: 'تاجر' }, { kind: 'pickup', label: 'استلام' }, { kind: 'dropoff', label: 'تسليم' }]} />
          <SimulatedTag />
        </div>
        <MapView className="h-[calc(100vh-14rem)] min-h-[420px]" markers={markers} routes={routes} zoom={12} focus={sel ? [sel.lat, sel.lng] : null} />
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Info className="size-3.5" /> المواقع في هذا النموذج تجريبية ومحاكاة، باستثناء الكابتن الذي فعّل موقع جهازه صراحةً. لا تُعرض كمواقع موثّقة.</p>
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4">
          {([['captains', 'الكباتن', Bike], ['merchants', 'التجار', Store], ['deliveries', 'التوصيلات النشطة', Package]] as const).map(([k, label, Icon]) => (
            <label key={k} className="flex cursor-pointer items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700"><Icon className="size-4 text-slate-400" /> {label}</span>
              <Switch checked={layers[k]} onChange={(v) => setLayers((l) => ({ ...l, [k]: v }))} label={label} />
            </label>
          ))}
        </Card>

        {sel && (
          <Card className="space-y-2 border-brand-500 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-navy-900">{sel.name}</span>
              <PresenceBadge presence={captainPresence(sel, orders)} />
            </div>
            <div className="text-xs text-slate-500">الرصيد المتاح: {money(walletOf(txs, sel.id).available)}</div>
            <div className="text-xs text-slate-500">الطلب المسند: {activeOrderOf(orders, sel.id)?.ref ?? 'لا يوجد'}</div>
            <GpsIndicator captain={sel} now={now} />
            <div className="text-xs text-slate-400">آخر تحديث: {relative(sel.locationUpdatedAt, now)}</div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <ul className="scrollbar-thin max-h-[calc(100vh-24rem)] min-h-40 divide-y divide-slate-100 overflow-y-auto">
            {captains.map((c) => {
              const p = captainPresence(c, orders)
              return (
                <li key={c.id}>
                  <button onClick={() => setParams({ captain: c.id }, { replace: true })} className={cn('flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-start hover:bg-slate-50', selected === c.id && 'bg-brand-50')}>
                    <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: PRESENCE[p].color }}>{c.code}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-slate-400">{relative(c.locationUpdatedAt, now)}</div>
                    </div>
                    {locationIsStale(c, now) && p !== 'inactive' && p !== 'offline' && <span className="text-[10px] font-medium text-rose-600">موقع قديم</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}
