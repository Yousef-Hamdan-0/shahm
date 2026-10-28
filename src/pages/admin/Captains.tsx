import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bike, Eye, MapPin, Pencil, Plus, Power, Search, Star, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Segmented, StarRating, Td, Th, useAction } from '../../components/ui'
import { GpsIndicator, PresenceBadge, captainPresence, type Presence } from '../../components/shared'
import { VEHICLE_LABEL, money, num } from '../../lib/format'
import { activeOrderOf, walletOf } from '../../lib/rules'
import type { Captain } from '../../lib/types'
import { useNow } from '../../lib/useNow'
import { CaptainDrawer, CaptainFormDialog, OrderDrawer, RateDialog, RechargeDialog, avgRating } from './dialogs'

export default function Captains() {
  const { captains, orders, txs, setCaptainStatus } = useStore()
  const navigate = useNavigate()
  const now = useNow(5000)
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | Presence>('all')
  const [form, setForm] = useState<{ open: boolean; captain?: Captain }>({ open: params.get('new') === '1' })
  const [viewId, setViewId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [recharge, setRecharge] = useState<Captain | null>(null)
  const [rate, setRate] = useState<Captain | null>(null)
  const [toggle, setToggle] = useState<Captain | null>(null)
  const { run, isPending } = useAction()

  const term = q.trim()
  const rows = captains.filter(
    (c) => (filter === 'all' || captainPresence(c, orders) === filter) && (!term || [c.name, c.phone, c.vehicleId, c.code].some((v) => v.includes(term))),
  )
  const count = (p: Presence) => captains.filter((c) => captainPresence(c, orders) === p).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الهاتف أو رقم المركبة" className="ps-9" />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'الكل', count: captains.length },
            { value: 'available', label: 'متاح', count: count('available') },
            { value: 'busy', label: 'في توصيلة', count: count('busy') },
            { value: 'offline', label: 'غير متاح', count: count('offline') },
            { value: 'inactive', label: 'موقوف', count: count('inactive') },
          ]}
        />
        <Button className="ms-auto" onClick={() => setForm({ open: true })}><Plus className="size-4" /> إضافة كابتن</Button>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<Bike className="size-5" />} title="لا يوجد كباتن مطابقون" description="جرّب تعديل البحث أو الفلتر." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <Th>الكابتن</Th><Th>الهاتف</Th><Th>المركبة</Th><Th>الحساب</Th><Th>التوفر</Th><Th>الرصيد المتاح</Th><Th>التقييم</Th><Th>آخر موقع</Th><Th>مكتملة</Th><Th className="text-end">إجراءات</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const w = walletOf(txs, c.id)
                  const active = activeOrderOf(orders, c.id)
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <Td>
                        <button className="flex cursor-pointer items-center gap-3 text-start" onClick={() => setViewId(c.id)}>
                          <span className="flex size-9 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{c.code}</span>
                          <span>
                            <span className="block font-medium text-slate-800 hover:text-brand-700">{c.name}</span>
                            {active && <span className="text-xs text-amber-600">{active.ref}</span>}
                          </span>
                        </button>
                      </Td>
                      <Td><span dir="ltr">{c.phone}</span></Td>
                      <Td><div className="text-sm">{VEHICLE_LABEL[c.vehicleType]}</div><div className="text-xs text-slate-400" dir="ltr">{c.vehicleId}</div></Td>
                      <Td>{c.status === 'active' ? <Badge tone="green">نشط</Badge> : <Badge tone="red">موقوف</Badge>}</Td>
                      <Td><PresenceBadge presence={captainPresence(c, orders)} /></Td>
                      <Td>
                        <div className={w.available <= 0 ? 'font-semibold text-rose-600' : 'font-semibold text-navy-900'}>{money(w.available)}</div>
                        {w.reserved > 0 && <div className="text-xs text-slate-400">محجوز {money(w.reserved)}</div>}
                      </Td>
                      <Td><div className="flex items-center gap-1.5"><StarRating value={avgRating(c)} size="sm" /><span className="text-xs text-slate-500">{avgRating(c).toFixed(1)}</span></div></Td>
                      <Td><GpsIndicator captain={c} now={now} compact /></Td>
                      <Td>{num(orders.filter((o) => o.captainId === c.id && o.status === 'delivered').length)}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="التفاصيل وسجل التوصيل" aria-label="التفاصيل" onClick={() => setViewId(c.id)}><Eye className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title="عرض على الخريطة" aria-label="عرض على الخريطة" onClick={() => navigate(`/admin/map?captain=${c.id}`)}><MapPin className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title="شحن المحفظة" aria-label="شحن المحفظة" className="text-brand-600 hover:bg-brand-50" onClick={() => setRecharge(c)}><Wallet className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title="تقييم" aria-label="تقييم" className="text-amber-500 hover:bg-amber-50" onClick={() => setRate(c)}><Star className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title="تعديل" aria-label="تعديل" onClick={() => setForm({ open: true, captain: c })}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title={c.status === 'active' ? 'إيقاف' : 'تفعيل'} aria-label={c.status === 'active' ? 'إيقاف' : 'تفعيل'} className={c.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-brand-600 hover:bg-brand-50'} onClick={() => setToggle(c)}><Power className="size-4" /></Button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form.open && <CaptainFormDialog open onClose={() => { setForm({ open: false }); if (params.get('new')) setParams({}, { replace: true }) }} captain={form.captain} />}
      <CaptainDrawer captainId={viewId} onClose={() => setViewId(null)} onOpenOrder={setOrderId} onShowOnMap={(id) => navigate(`/admin/map?captain=${id}`)} />
      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} />
      {recharge && <RechargeDialog captain={recharge} onClose={() => setRecharge(null)} />}
      {rate && <RateDialog captain={rate} onClose={() => setRate(null)} />}
      <ConfirmDialog
        open={!!toggle}
        onClose={() => setToggle(null)}
        loading={isPending('toggle')}
        tone={toggle?.status === 'active' ? 'danger' : 'brand'}
        title={toggle?.status === 'active' ? `إيقاف حساب ${toggle?.name}؟` : `تفعيل حساب ${toggle?.name}؟`}
        description={
          toggle?.status === 'active'
            ? toggle && activeOrderOf(orders, toggle.id)
              ? 'لدى الكابتن توصيلة جارية ستستمر، لكنه لن يستقبل طلبات جديدة.'
              : 'سيتم تحويل الكابتن إلى غير متاح ولن يستقبل أي طلبات.'
            : 'سيتمكن الكابتن من تفعيل التوفر واستقبال الطلبات عند استيفاء الشروط.'
        }
        confirmLabel={toggle?.status === 'active' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
        onConfirm={() =>
          run('toggle', () => {
            if (!toggle) return
            setCaptainStatus(toggle.id, toggle.status === 'active' ? 'inactive' : 'active')
            toast.success(toggle.status === 'active' ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب')
            setToggle(null)
          })
        }
      />
    </div>
  )
}
