import { useState } from 'react'
import { History as HistoryIcon } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Badge, Card, EmptyState, Segmented, Select } from '../../components/ui'
import { OrderStatusBadge } from '../../components/shared'
import { dateTime, money } from '../../lib/format'
import { isActiveDelivery } from '../../lib/rules'
import { useCaptain } from './CaptainLayout'

type StatusFilter = 'all' | 'delivered' | 'cancelled' | 'returned'
type DateFilter = 'all' | 'today' | 'yesterday' | 'week'

const DAY = 86400000

function inRange(ts: number, f: DateFilter) {
  if (f === 'all') return true
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const today = start.getTime()
  if (f === 'today') return ts >= today
  if (f === 'yesterday') return ts >= today - DAY && ts < today
  return ts >= today - 6 * DAY
}

export default function History() {
  const captain = useCaptain()!
  const { orders, merchants } = useStore()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [date, setDate] = useState<DateFilter>('all')

  // Completed or cancelled deliveries, plus private offers this captain previously declined
  const mine = orders
    .filter((o) => (o.captainId === captain.id && !isActiveDelivery(o)) || o.rejectedBy.includes(captain.id))
    .sort((a, b) => b.createdAt - a.createdAt)
  const kind = (o: (typeof mine)[number]): StatusFilter => (o.captainId !== captain.id ? 'returned' : o.status === 'delivered' ? 'delivered' : 'cancelled')
  const rows = mine.filter((o) => (status === 'all' || kind(o) === status) && inRange(o.timeline.at(-1)!.at, date))
  const earnedFees = rows.filter((o) => kind(o) === 'delivered').reduce((s, o) => s + o.fee, 0)

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-navy-900">سجل الطلبات</h2>
      <Segmented
        className="w-full"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: 'الكل' },
          { value: 'delivered', label: 'مكتملة' },
          { value: 'cancelled', label: 'ملغاة' },
          { value: 'returned', label: 'مرفوضة' },
        ]}
      />
      <div className="flex items-center gap-2">
        <Select value={date} onChange={(e) => setDate(e.target.value as DateFilter)} className="h-11" aria-label="الفترة">
          <option value="all">كل الفترات</option>
          <option value="today">اليوم</option>
          <option value="yesterday">أمس</option>
          <option value="week">آخر 7 أيام</option>
        </Select>
      </div>
      {rows.length > 0 && (
        <p className="text-xs text-slate-500">{rows.length} طلب · رسوم توصيلات مكتملة {money(earnedFees)}</p>
      )}
      {rows.length === 0 ? (
        <Card><EmptyState icon={<HistoryIcon className="size-6" />} title="لا توجد طلبات في هذا السجل" description="جرّب تغيير الفلاتر." /></Card>
      ) : (
        rows.map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-navy-900">{merchants.find((m) => m.id === o.merchantId)?.name}</div>
                <div className="text-xs text-slate-500">{o.pickupArea} ← {o.dropoffArea}</div>
                <div className="mt-1 text-xs text-slate-400">{o.ref} · {dateTime(o.timeline.at(-1)!.at)}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {kind(o) === 'returned' ? <Badge tone="amber">رفضت العرض</Badge> : <OrderStatusBadge status={o.status} />}
                <span className="text-sm font-semibold">{money(o.fee)}</span>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
