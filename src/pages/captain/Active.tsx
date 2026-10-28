import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MapPinOff, Navigation, Phone, RefreshCw, Store, User, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Button, Card, ConfirmDialog, EmptyState, useAction } from '../../components/ui'
import { DirectionsLink, GpsIndicator, OrderProgress } from '../../components/shared'
import { MapView, type MapMarker } from '../../components/MapView'
import { money, relative } from '../../lib/format'
import { CAPTAIN_NEXT, activeOrderOf, gpsHealthy, locationIsStale } from '../../lib/rules'
import type { Order, OrderStatus } from '../../lib/types'
import { useNow } from '../../lib/useNow'
import { requestBrowserLocation, useCaptain, useGeoError } from './CaptainLayout'

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  accepted: 'بدء التوجه إلى المتجر',
  heading_to_pickup: 'تأكيد استلام الطلب من المتجر',
  picked_up: 'بدء التوجه إلى العميل',
  on_the_way: 'تأكيد تسليم الطلب للعميل',
}

export default function Active() {
  const captain = useCaptain()!
  const { orders, merchants, advanceOrder, setGpsLost, simulateGpsStep } = useStore()
  const navigate = useNavigate()
  const now = useNow(2000)
  const geoError = useGeoError()
  const { run, isPending } = useAction()
  const [confirmDeliver, setConfirmDeliver] = useState(false)
  const [completed, setCompleted] = useState<Order | null>(null)
  const order = activeOrderOf(orders, captain.id)

  if (completed && !order)
    return (
      <Card className="p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-brand-500" />
        <p className="mt-3 text-lg font-bold text-navy-900">تم التوصيل بنجاح</p>
        <p className="mt-1 text-sm text-slate-500">الطلب {completed.ref} · تم خصم {money(completed.fee)} من الرصيد المحجوز في محفظتك.</p>
        <div className="mt-5 grid gap-2">
          <Button size="lg" onClick={() => navigate('/captain')}>عرض الطلبات المتاحة</Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/captain/wallet')}>المحفظة</Button>
        </div>
      </Card>
    )

  if (!order)
    return (
      <Card>
        <EmptyState icon={<Navigation className="size-6" />} title="لا توجد توصيلة نشطة" description="عند قبول طلب ستظهر تفاصيل التوصيل والخريطة هنا." action={<Button onClick={() => navigate('/captain')}>الطلبات المتاحة</Button>} />
      </Card>
    )

  const m = merchants.find((x) => x.id === order.merchantId)
  const next = CAPTAIN_NEXT[order.status]!
  const towardPickup = order.status === 'accepted' || order.status === 'heading_to_pickup'
  const healthy = gpsHealthy(captain)
  const markers: MapMarker[] = [
    { id: 'p', lat: order.pickupLat, lng: order.pickupLng, kind: 'pickup' },
    { id: 'd', lat: order.dropoffLat, lng: order.dropoffLng, kind: 'dropoff' },
    { id: 'me', lat: captain.lat, lng: captain.lng, kind: healthy ? 'me' : 'stale', label: captain.code },
  ]

  const advance = () =>
    run('advance', () => {
      const snapshot = order
      const r = advanceOrder(order.id, captain.id)
      if (!r.ok) return void toast.error(r.error)
      setConfirmDeliver(false)
      if (r.status === 'delivered') {
        setCompleted(snapshot)
        toast.success('تم تأكيد التسليم', { description: r.note })
      } else toast.success('تم تحديث حالة الطلب')
    })

  return (
    <div className="space-y-3">
      {!healthy && (
        <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="flex gap-2 font-medium"><WifiOff className="mt-0.5 size-4 shrink-0" /> فُقدت إشارة الموقع</div>
          <p className="text-xs leading-relaxed">
            آخر موقع معروف {relative(captain.locationUpdatedAt, now)} وقد لا يكون دقيقاً. يمكنك متابعة التوصيل، لكن الإدارة والتاجر يرون موقعك كموقع قديم.
            {geoError && ` ${geoError}`}
          </p>
          <Button size="sm" variant="outline" onClick={() => { if (captain.gpsMode === 'browser') requestBrowserLocation(captain.id); else setGpsLost(captain.id, false); toast('جاري إعادة الاتصال بخدمة الموقع…') }}>
            <RefreshCw className="size-3.5" /> إعادة المحاولة
          </Button>
        </div>
      )}
      {healthy && locationIsStale(captain, now) && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><MapPinOff className="size-4 shrink-0" /> لم يتحدث موقعك منذ {relative(captain.locationUpdatedAt, now)}.</div>
      )}

      <Card className="overflow-hidden">
        <MapView className="h-56 rounded-none border-0" markers={markers} fit routes={[{ points: [[captain.lat, captain.lng], towardPickup ? [order.pickupLat, order.pickupLng] : [order.dropoffLat, order.dropoffLng]], dashed: true, color: '#10B981' }]} />
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <GpsIndicator captain={captain} now={now} />
          <span className="text-xs text-slate-400">{order.ref}</span>
        </div>
      </Card>

      {/* Presenter-only simulation strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
        <span className="font-medium">محاكاة للعرض:</span>
        <button className="underline disabled:opacity-40" disabled={!healthy} onClick={() => { const r = simulateGpsStep(captain.id); if (!r.ok) toast.error(r.error) }}>تحريك الموقع</button>
        <span>·</span>
        <button className="underline" onClick={() => { setGpsLost(captain.id, healthy); toast(healthy ? 'تمت محاكاة فقدان الإشارة' : 'تمت محاكاة عودة الإشارة') }}>{healthy ? 'محاكاة فقدان GPS' : 'محاكاة عودة GPS'}</button>
      </div>

      <Card className="divide-y divide-slate-100">
        <div className={`space-y-2 p-4 ${towardPickup ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600"><Store className="size-3.5" /> الاستلام من المتجر</div>
          <div className="font-semibold text-navy-900">{m?.name}</div>
          <div className="text-sm text-slate-600">{order.pickupAddress}</div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {m && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700"><Phone className="size-4" /> اتصال بالمتجر</a>}
            <DirectionsLink lat={order.pickupLat} lng={order.pickupLng} />
          </div>
        </div>
        <div className={`space-y-2 p-4 ${towardPickup ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-2 text-xs font-medium text-rose-600"><User className="size-3.5" /> التسليم للعميل</div>
          <div className="font-semibold text-navy-900">{order.customerName || 'عميل'} · <span dir="ltr" className="font-normal">{order.customerPhone}</span></div>
          <div className="text-sm text-slate-600">{order.dropoffAddress}</div>
          {order.locationNotes && <div className="text-xs text-slate-500">{order.locationNotes}</div>}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700"><Phone className="size-4" /> اتصال بالعميل</a>
            <DirectionsLink lat={order.dropoffLat} lng={order.dropoffLng} />
          </div>
        </div>
        {order.instructions && <div className="p-4 text-sm"><span className="text-xs text-slate-400">تعليمات: </span>{order.instructions}</div>}
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-slate-500">رسوم التوصيل (محجوزة)</span>
          <span className="text-lg font-bold text-navy-900">{money(order.fee)}</span>
        </div>
      </Card>

      <Card className="p-4">
        <OrderProgress order={order} compact />
      </Card>

      <div className="fixed inset-x-0 bottom-[68px] z-[400] mx-auto max-w-[440px] bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 pt-6 pb-3">
        <Button size="xl" variant={next === 'delivered' ? 'brand' : 'primary'} className="w-full" loading={isPending('advance')} onClick={() => (next === 'delivered' ? setConfirmDeliver(true) : advance())}>
          {ACTION_LABEL[order.status]}
        </Button>
      </div>
      <div className="h-20" />

      <ConfirmDialog
        open={confirmDeliver}
        onClose={() => setConfirmDeliver(false)}
        onConfirm={advance}
        loading={isPending('advance')}
        tone="brand"
        title="تأكيد تسليم الطلب؟"
        description={`سيتم إغلاق الطلب ${order.ref} وخصم ${money(order.fee)} المحجوزة من محفظتك.`}
        confirmLabel="تم التسليم"
      />
    </div>
  )
}
