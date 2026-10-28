import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Lock, Package, Radio, Search, Send, UserCheck } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Button, Card, EmptyState, Input, Segmented, Select, Td, Th } from '../../components/ui'
import { OrderStatusBadge } from '../../components/shared'
import { dateTime, money, relative } from '../../lib/format'
import { ACTIVE_DELIVERY, DISPATCH_QUEUE, canTransition } from '../../lib/rules'
import type { Order, OrderStatus } from '../../lib/types'
import { useNow } from '../../lib/useNow'
import { AssignDialog, CreateOrderDialog, OrderDrawer } from './dialogs'

type View = 'all' | 'queue' | 'open' | 'active' | 'delivered' | 'cancelled'
const VIEW_STATUSES: Record<Exclude<View, 'all'>, OrderStatus[]> = {
  queue: DISPATCH_QUEUE,
  open: ['awaiting_captain', 'offered_privately'],
  active: ACTIVE_DELIVERY,
  delivered: ['delivered'],
  cancelled: ['cancelled'],
}

export default function Orders() {
  const { orders, merchants, captains, settings } = useStore()
  const now = useNow(10000)
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'all'
  const merchantFilter = params.get('merchant') ?? ''
  const [q, setQ] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [assign, setAssign] = useState<Order | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v && v !== 'all') next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const byView = (v: View) => (v === 'all' ? orders : orders.filter((o) => VIEW_STATUSES[v].includes(o.status)))
  const term = q.trim()
  const rows = byView(view)
        .filter((o) => !merchantFilter || o.merchantId === merchantFilter)
        .filter((o) => {
          if (!term) return true
          const m = merchants.find((x) => x.id === o.merchantId)
          const c = captains.find((x) => x.id === o.captainId)
          return [o.ref, o.customerPhone, o.customerName, o.dropoffAddress, m?.name ?? '', c?.name ?? ''].some((v) => v.includes(term))
        })
        .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="space-y-4">
      {!settings.publicBroadcasting && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Radio className="size-4" />
          <span className="flex-1">البث العام متوقف. الطلبات الجديدة والطلبات غير المقبولة تنتظر في قائمة التوجيه. التوصيلات الجارية والتوجيه الخاص يعملان بشكل طبيعي.</span>
          <Link to="/admin/settings" className="font-medium underline">إدارة البث</Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={view}
          onChange={(v) => setParam('view', v)}
          options={[
            { value: 'all', label: 'الكل', count: orders.length },
            { value: 'queue', label: 'قائمة التوجيه', count: byView('queue').length },
            { value: 'open', label: 'بانتظار القبول', count: byView('open').length },
            { value: 'active', label: 'قيد التوصيل', count: byView('active').length },
            { value: 'delivered', label: 'مكتملة', count: byView('delivered').length },
            { value: 'cancelled', label: 'ملغاة', count: byView('cancelled').length },
          ]}
        />
        <Button className="ms-auto" onClick={() => setCreateOpen(true)}><Send className="size-4" /> توجيه خاص لطلب جديد</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم الطلب، هاتف العميل، التاجر، الكابتن" className="ps-9" />
        </div>
        <Select value={merchantFilter} onChange={(e) => setParam('merchant', e.target.value)} className="w-56" aria-label="فلترة حسب التاجر">
          <option value="">جميع التجار</option>
          {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>

      {view === 'queue' && (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Lock className="size-4" /> طلبات تنتظر قرار الإدارة: رُفض عرضها الخاص، أو انتهت مهلته، أو أوقف البث العام نشرها.</p>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<Package className="size-5" />} title={view === 'queue' ? 'قائمة التوجيه فارغة' : 'لا توجد طلبات مطابقة'} description={view === 'queue' ? 'جميع الطلبات تم توجيهها.' : 'جرّب تعديل البحث أو الفلاتر.'} />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr><Th>رقم الطلب</Th><Th>التاجر</Th><Th>هاتف العميل</Th><Th>الاستلام</Th><Th>التسليم</Th><Th>الرسوم</Th><Th>الكابتن</Th><Th>الحالة</Th><Th>وقت الإنشاء</Th><Th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((o) => {
                  const c = captains.find((x) => x.id === (o.captainId ?? o.privateCaptainId))
                  return (
                    <tr key={o.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setOrderId(o.id)}>
                      <Td className="font-medium text-navy-900">{o.ref}</Td>
                      <Td>{merchants.find((m) => m.id === o.merchantId)?.name}</Td>
                      <Td><span dir="ltr">{o.customerPhone}</span></Td>
                      <Td className="text-slate-600">{o.pickupArea}</Td>
                      <Td className="max-w-48 truncate text-slate-600">{o.dropoffAddress}</Td>
                      <Td className="font-medium">{money(o.fee)}</Td>
                      <Td>{c ? <span className={o.status === 'offered_privately' ? 'text-violet-700' : ''}>{o.status === 'offered_privately' && <Lock className="me-1 inline size-3" />}{c.name}</span> : <span className="text-slate-400">—</span>}</Td>
                      <Td><OrderStatusBadge status={o.status} /></Td>
                      <Td className="text-slate-500"><div>{dateTime(o.createdAt)}</div><div className="text-xs text-slate-400">{relative(o.createdAt, now)}</div></Td>
                      <Td>
                        {canTransition(o.status, 'offered_privately') && (
                          <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); setAssign(o) }}><UserCheck className="size-3.5" /> توجيه</Button>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} />
      {assign && <AssignDialog order={assign} onClose={() => setAssign(null)} />}
      {createOpen && <CreateOrderDialog open onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
