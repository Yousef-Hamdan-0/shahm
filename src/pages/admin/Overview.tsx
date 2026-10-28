import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Bike, CheckCircle2, Clock, Coins, MapPinOff, Package, Plus, Radio, Send, Store, UserCheck, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../../store/useStore'
import { Button, Card, CardHeader, EmptyState } from '../../components/ui'
import { OrderStatusBadge, PRESENCE, captainPresence, type Presence } from '../../components/shared'
import { isToday, money, num, relative, weekday } from '../../lib/format'
import { ACTIVE_DELIVERY, DISPATCH_QUEUE, gpsHealthy, isActiveDelivery, walletOf } from '../../lib/rules'
import { useNow } from '../../lib/useNow'
import { CaptainFormDialog, CreateOrderDialog, MerchantFormDialog, OrderDrawer } from './dialogs'

export default function Overview() {
  const { merchants, captains, orders, txs, dailyStats, settings } = useStore()
  const now = useNow(15000)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'merchant' | 'captain' | 'order' | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const presence = useMemo(() => {
    const counts: Record<Presence, number> = { available: 0, busy: 0, offline: 0, inactive: 0 }
    captains.forEach((c) => counts[captainPresence(c, orders)]++)
    return counts
  }, [captains, orders])

  const activeOrders = orders.filter((o) => ACTIVE_DELIVERY.includes(o.status)).length
  const unassigned = orders.filter((o) => ['awaiting_captain', 'offered_privately', ...DISPATCH_QUEUE].includes(o.status)).length
  const completedToday = orders.filter((o) => o.status === 'delivered' && isToday(o.timeline.at(-1)!.at)).length
  const collected = txs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0)

  const chart = useMemo(() => {
    const DAY = 86400000
    const rows = dailyStats.map((d) => ({ day: weekday(now - d.daysAgo * DAY), created: d.created, delivered: d.delivered }))
    rows.push({
      day: 'اليوم',
      created: orders.filter((o) => isToday(o.createdAt)).length,
      delivered: completedToday,
    })
    return rows
  }, [dailyStats, orders, completedToday, now])

  const alerts = useMemo(() => {
    const list: { icon: typeof AlertTriangle; tone: string; text: string; to: string }[] = []
    const queue = orders.filter((o) => o.status === 'pending_dispatch').length
    const expired = orders.filter((o) => o.status === 'dispatch_expired').length
    if (!settings.publicBroadcasting) list.push({ icon: Radio, tone: 'text-amber-600 bg-amber-50', text: 'البث العام متوقف – الطلبات الجديدة تنتظر التوجيه اليدوي', to: '/admin/settings' })
    if (queue) list.push({ icon: Clock, tone: 'text-amber-600 bg-amber-50', text: `${num(queue)} طلب بانتظار توجيه الإدارة`, to: '/admin/orders?view=queue' })
    if (expired) list.push({ icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50', text: `${num(expired)} عرض خاص انتهت مهلته دون رد`, to: '/admin/orders?view=queue' })
    captains.forEach((c) => {
      const active = orders.find((o) => o.captainId === c.id && isActiveDelivery(o))
      if (active && !gpsHealthy(c)) list.push({ icon: MapPinOff, tone: 'text-rose-600 bg-rose-50', text: `فقدان إشارة الموقع للكابتن ${c.name} أثناء ${active.ref}`, to: `/admin/map?captain=${c.id}` })
      if (c.status === 'active' && c.available && walletOf(txs, c.id).available <= 0)
        list.push({ icon: Wallet, tone: 'text-amber-600 bg-amber-50', text: `رصيد الكابتن ${c.name} صفر – لن يستقبل طلبات`, to: '/admin/wallets' })
    })
    return list
  }, [orders, captains, txs, settings.publicBroadcasting])

  const kpis = [
    { label: 'إجمالي التجار', value: num(merchants.length), sub: `${num(merchants.filter((m) => m.status === 'active').length)} نشط`, icon: Store },
    { label: 'إجمالي الكباتن', value: num(captains.length), sub: `${num(captains.filter((c) => c.status === 'active').length)} حساب نشط`, icon: Bike },
    { label: 'كباتن متاحون', value: num(presence.available), sub: `${num(presence.busy)} في توصيلة`, icon: UserCheck, accent: true },
    { label: 'طلبات نشطة', value: num(activeOrders), sub: `${num(unassigned)} بانتظار كابتن`, icon: Package },
    { label: 'مكتملة اليوم', value: num(completedToday), sub: 'توصيلات منجزة', icon: CheckCircle2 },
    { label: 'رسوم التوصيل المحصّلة', value: money(collected), sub: 'خصومات مكتملة من المحافظ', icon: Coins },
  ]

  const recent = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-900">لوحة العمليات</h2>
          <p className="text-sm text-slate-500">ملخص عمليات التوصيل في عمّان</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialog('merchant')}><Plus className="size-4" /> تاجر جديد</Button>
          <Button variant="outline" onClick={() => setDialog('captain')}><Plus className="size-4" /> كابتن جديد</Button>
          <Button onClick={() => setDialog('order')}><Send className="size-4" /> توجيه طلب يدوي</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{k.label}</span>
              <span className={k.accent ? 'rounded-lg bg-brand-50 p-1.5 text-brand-600' : 'rounded-lg bg-slate-100 p-1.5 text-slate-500'}>
                <k.icon className="size-4" />
              </span>
            </div>
            <div className="mt-3 text-2xl font-bold text-navy-900">{k.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{k.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="نشاط الطلبات" description="آخر 7 أيام · بيانات الأيام السابقة ثابتة للعرض، وبيانات اليوم مباشرة من النموذج" />
          <div className="h-72 px-2 py-4" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={4} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#EEF2F6" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', direction: 'rtl', fontFamily: 'inherit' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, direction: 'rtl' }} />
                <Bar dataKey="created" name="طلبات جديدة" fill="#101F35" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="delivered" name="تم التوصيل" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="توفر الكباتن" action={<Link to="/admin/map" className="text-xs font-medium text-brand-700 hover:underline">الخريطة الحية</Link>} />
          <div className="space-y-4 p-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {(Object.keys(presence) as Presence[]).map((p) => (
                <div key={p} style={{ width: `${(presence[p] / Math.max(captains.length, 1)) * 100}%`, background: PRESENCE[p].color }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(presence) as Presence[]).map((p) => (
                <div key={p} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500"><span className="size-2 rounded-full" style={{ background: PRESENCE[p].color }} />{PRESENCE[p].label}</div>
                  <div className="mt-1 text-xl font-bold text-navy-900">{num(presence[p])}</div>
                </div>
              ))}
            </div>
            <ul className="space-y-2">
              {captains.filter((c) => captainPresence(c, orders) !== 'inactive').slice(0, 5).map((c) => {
                const p = captainPresence(c, orders)
                return (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="size-2 rounded-full" style={{ background: PRESENCE[p].color }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-slate-400">{money(walletOf(txs, c.id).available)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="أحدث طلبات التوصيل" action={<Link to="/admin/orders" className="text-xs font-medium text-brand-700 hover:underline">عرض الكل</Link>} />
          <ul className="divide-y divide-slate-100">
            {recent.map((o) => (
              <li key={o.id}>
                <button onClick={() => setOrderId(o.id)} className="flex w-full cursor-pointer items-center gap-4 px-5 py-3 text-start hover:bg-slate-50">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Package className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">{o.ref} · {merchants.find((m) => m.id === o.merchantId)?.name}</div>
                    <div className="truncate text-xs text-slate-500">{o.pickupArea} ← {o.dropoffArea} · {relative(o.createdAt, now)}</div>
                  </div>
                  <span className="hidden text-sm font-medium text-slate-700 sm:block">{money(o.fee)}</span>
                  <OrderStatusBadge status={o.status} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="تنبيهات تشغيلية" description={`${num(alerts.length)} تنبيه`} />
          {alerts.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-5" />} title="لا توجد تنبيهات" description="جميع العمليات تسير بشكل طبيعي." />
          ) : (
            <ul className="space-y-2 p-4">
              {alerts.map((a, i) => (
                <li key={i}>
                  <button onClick={() => navigate(a.to)} className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-start text-sm hover:bg-slate-50">
                    <span className={`rounded-lg p-1.5 ${a.tone}`}><a.icon className="size-4" /></span>
                    <span className="flex-1 pt-0.5 text-slate-700">{a.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {dialog === 'merchant' && <MerchantFormDialog open onClose={() => setDialog(null)} />}
      {dialog === 'captain' && <CaptainFormDialog open onClose={() => setDialog(null)} />}
      {dialog === 'order' && <CreateOrderDialog open onClose={() => setDialog(null)} />}
      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </div>
  )
}
