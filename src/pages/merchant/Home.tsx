import { Link, useNavigate } from 'react-router-dom'
import { Bike, ChevronLeft, Package, Phone } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Card, CardHeader, EmptyState } from '../../components/ui'
import { OrderStatusBadge } from '../../components/shared'
import { isToday, money, num, relative } from '../../lib/format'
import { isOpen } from '../../lib/rules'
import { useNow } from '../../lib/useNow'
import { useMerchant } from './MerchantLayout'
import { MerchantProgressBar } from './OrderDetail'

export default function Home() {
  const merchant = useMerchant()!
  const allOrders = useStore((s) => s.orders)
  const captains = useStore((s) => s.captains)
  const navigate = useNavigate()
  const now = useNow(15000)
  const mine = allOrders.filter((o) => o.merchantId === merchant.id).sort((a, b) => b.createdAt - a.createdAt)
  const active = mine.filter(isOpen)
  const recent = mine.filter((o) => !isOpen(o)).slice(0, 5)
  const deliveredToday = mine.filter((o) => o.status === 'delivered' && isToday(o.timeline.at(-1)!.at)).length

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">أهلاً بك 👋</p>
        <h1 className="text-2xl font-bold text-navy-900">{merchant.name}</h1>
      </div>

      <button
        onClick={() => navigate('/merchant/request')}
        disabled={merchant.status !== 'active'}
        className="group flex w-full cursor-pointer items-center gap-5 rounded-3xl bg-navy-900 p-6 text-start text-white shadow-lg shadow-navy-900/10 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50 sm:p-8"
      >
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-500 sm:size-20">
          <Bike className="size-8 sm:size-10" />
        </span>
        <span className="flex-1">
          <span className="block text-2xl font-bold sm:text-3xl">طلب كابتن</span>
          <span className="mt-1 block text-sm text-white/60">أرسل طلب توصيل جديد خلال أقل من دقيقة</span>
        </span>
        <ChevronLeft className="size-7 text-white/40 transition group-hover:-translate-x-1" />
      </button>

      <div className="grid grid-cols-3 gap-3">
        {[['طلبات نشطة', active.length], ['تم توصيلها اليوم', deliveredToday], ['إجمالي الطلبات', mine.length]].map(([l, v]) => (
          <Card key={l as string} className="p-4 text-center">
            <div className="text-2xl font-bold text-navy-900">{num(v as number)}</div>
            <div className="mt-0.5 text-xs text-slate-500">{l}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="الطلبات النشطة" />
        {active.length === 0 ? (
          <EmptyState icon={<Package className="size-5" />} title="لا توجد طلبات نشطة" description="عند طلب كابتن ستظهر حالة التوصيل هنا مباشرة." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((o) => {
              const c = captains.find((x) => x.id === o.captainId)
              return (
                <li key={o.id}>
                  <Link to={`/merchant/orders/${o.id}`} className="block space-y-3 px-5 py-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-navy-900">{o.ref} · {o.customerName || 'عميل'}</div>
                        <div className="text-xs text-slate-500">{o.dropoffAddress} · {relative(o.createdAt, now)}</div>
                      </div>
                      <OrderStatusBadge status={o.status} audience="merchant" />
                    </div>
                    <MerchantProgressBar status={o.status} />
                    {c && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Bike className="size-3.5" /> الكابتن {c.name} <span className="text-slate-300">·</span> <Phone className="size-3" /><span dir="ltr">{c.phone}</span>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="آخر الطلبات" action={<Link to="/merchant/orders" className="text-xs font-medium text-brand-700 hover:underline">سجل الطلبات</Link>} />
        {recent.length === 0 ? (
          <EmptyState icon={<Package className="size-5" />} title="لا يوجد سجل بعد" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((o) => (
              <li key={o.id}>
                <Link to={`/merchant/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{o.ref} · {o.dropoffArea}</div>
                    <div className="text-xs text-slate-500">{relative(o.createdAt, now)} · {money(o.fee)}</div>
                  </div>
                  <OrderStatusBadge status={o.status} audience="merchant" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
