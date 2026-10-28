import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Ban, Bike, Package, Phone, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, KeyVal, useAction } from '../../components/ui'
import { OrderProgress, OrderStatusBadge, SimulatedTag } from '../../components/shared'
import { MapView, type MapMarker } from '../../components/MapView'
import { VEHICLE_LABEL, dateTime, money } from '../../lib/format'
import { UNASSIGNED, isActiveDelivery } from '../../lib/rules'
import type { OrderStatus } from '../../lib/types'
import { cn } from '../../lib/cn'
import { useMerchant } from './MerchantLayout'

const BAR: OrderStatus[] = ['accepted', 'heading_to_pickup', 'picked_up', 'on_the_way', 'delivered']

export function MerchantProgressBar({ status }: { status: OrderStatus }) {
  const idx = BAR.indexOf(status)
  return (
    <div className="flex gap-1">
      {BAR.map((s, i) => (
        <span key={s} className={cn('h-1.5 flex-1 rounded-full', i <= idx ? 'bg-brand-500' : 'bg-slate-200', i === idx + 1 && idx >= -1 && status !== 'cancelled' && 'animate-pulse bg-brand-200')} />
      ))}
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const merchant = useMerchant()!
  const order = useStore((s) => s.orders.find((o) => o.id === id))
  const captain = useStore((s) => s.captains.find((c) => c.id === order?.captainId))
  const cancelOrder = useStore((s) => s.cancelOrder)
  const [confirm, setConfirm] = useState(false)
  const { run, isPending } = useAction()

  // Merchants can only open their own orders
  if (!order || order.merchantId !== merchant.id)
    return <EmptyState icon={<Package className="size-5" />} title="الطلب غير موجود" description="قد يكون الرابط غير صحيح أو أن الطلب لا يخص متجرك." action={<Link to="/merchant/orders"><Button variant="outline">العودة للطلبات</Button></Link>} />

  const live = captain && isActiveDelivery(order)
  const markers: MapMarker[] = [
    { id: 'p', lat: order.pickupLat, lng: order.pickupLng, kind: 'pickup' },
    { id: 'd', lat: order.dropoffLat, lng: order.dropoffLng, kind: 'dropoff' },
  ]
  if (live) markers.push({ id: 'c', lat: captain.lat, lng: captain.lng, kind: 'busy', label: captain.code })
  const rating = captain?.ratings.length ? captain.ratings.reduce((s, r) => s + r.stars, 0) / captain.ratings.length : 0

  return (
    <div className="space-y-5">
      <Link to="/merchant/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900"><ArrowRight className="size-4" /> طلباتي</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{order.ref}</h1>
          <p className="text-sm text-slate-500">{dateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} audience="merchant" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <MapView className="h-72 rounded-none border-0" markers={markers} fit routes={[{ points: [[order.pickupLat, order.pickupLng], [order.dropoffLat, order.dropoffLng]], dashed: true }]} />
            {live && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                <span>موقع الكابتن يتحدث تلقائياً</span>
                <SimulatedTag />
              </div>
            )}
          </Card>

          {captain && (
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-navy-900 text-white"><Bike className="size-6" /></span>
                <div className="flex-1">
                  <div className="font-semibold text-navy-900">{captain.name}</div>
                  <div className="text-sm text-slate-500">{VEHICLE_LABEL[captain.vehicleType]} · <span dir="ltr">{captain.vehicleId}</span></div>
                  {rating > 0 && <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600"><Star className="size-3" fill="currentColor" /> {rating.toFixed(1)}</div>}
                </div>
                <a href={`tel:${captain.phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50"><Phone className="size-4" /> اتصال</a>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="تفاصيل الطلب" />
            <div className="divide-y divide-slate-100 px-5">
              <KeyVal label="العميل">{order.customerName || '—'}</KeyVal>
              <KeyVal label="هاتف العميل"><span dir="ltr">{order.customerPhone}</span></KeyVal>
              <KeyVal label="عنوان التسليم">{order.dropoffAddress}</KeyVal>
              {order.locationNotes && <KeyVal label="ملاحظات الموقع">{order.locationNotes}</KeyVal>}
              {order.instructions && <KeyVal label="التعليمات">{order.instructions}</KeyVal>}
              {order.merchantRef && <KeyVal label="مرجع الطلب">{order.merchantRef}</KeyVal>}
              <KeyVal label="رسوم التوصيل">{money(order.fee)}</KeyVal>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="حالة التوصيل" />
            <div className="p-5"><OrderProgress order={order} /></div>
          </Card>
          {UNASSIGNED.includes(order.status) && (
            <Button variant="outline" className="w-full text-rose-600 hover:bg-rose-50" onClick={() => setConfirm(true)}><Ban className="size-4" /> إلغاء الطلب</Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        loading={isPending('cancel')}
        tone="danger"
        title="إلغاء الطلب؟"
        description="سيتم إلغاء الطلب ولن يظهر للكباتن. لا يمكن التراجع."
        confirmLabel="إلغاء الطلب"
        onConfirm={() =>
          run('cancel', () => {
            const r = cancelOrder(order.id, 'merchant', 'ألغي من قبل التاجر')
            r.ok ? toast.success('تم إلغاء الطلب') : toast.error(r.error)
            setConfirm(false)
          })
        }
      />
    </div>
  )
}
