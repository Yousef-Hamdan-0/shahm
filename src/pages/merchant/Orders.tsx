import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Plus, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Button, Card, EmptyState, Input, Segmented } from '../../components/ui'
import { OrderStatusBadge } from '../../components/shared'
import { dateTime, money } from '../../lib/format'
import { isOpen } from '../../lib/rules'
import { useMerchant } from './MerchantLayout'

type Filter = 'all' | 'active' | 'delivered' | 'cancelled'

export default function Orders() {
  const merchant = useMerchant()!
  const all = useStore((s) => s.orders)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const mine = all.filter((o) => o.merchantId === merchant.id).sort((a, b) => b.createdAt - a.createdAt)
  const match = (f: Filter) => (o: (typeof mine)[number]) => f === 'all' || (f === 'active' ? isOpen(o) : o.status === f)
  const term = q.trim()
  const rows = mine.filter(match(filter)).filter((o) => !term || [o.ref, o.customerPhone, o.customerName, o.dropoffAddress, o.merchantRef].some((v) => v.includes(term)))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">طلباتي</h1>
        <Link to="/merchant/request"><Button variant="brand" disabled={merchant.status !== 'active'}><Plus className="size-4" /> طلب كابتن</Button></Link>
      </div>
      <div className="flex flex-wrap gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'الكل', count: mine.length },
            { value: 'active', label: 'نشطة', count: mine.filter(match('active')).length },
            { value: 'delivered', label: 'تم التوصيل', count: mine.filter(match('delivered')).length },
            { value: 'cancelled', label: 'ملغاة', count: mine.filter(match('cancelled')).length },
          ]}
        />
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم الطلب أو هاتف العميل" className="ps-9" />
        </div>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Package className="size-5" />} title="لا توجد طلبات" description={mine.length ? 'لا توجد نتائج مطابقة للفلتر.' : 'ابدأ بطلب كابتن لأول توصيلة.'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((o) => (
              <li key={o.id}>
                <Link to={`/merchant/orders/${o.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:flex"><Package className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-navy-900">{o.ref} <span className="font-normal text-slate-500">· {o.customerName || 'عميل'}</span></div>
                    <div className="truncate text-xs text-slate-500">{o.dropoffAddress} · {dateTime(o.createdAt)}</div>
                  </div>
                  <span className="hidden text-sm font-medium sm:block">{money(o.fee)}</span>
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
