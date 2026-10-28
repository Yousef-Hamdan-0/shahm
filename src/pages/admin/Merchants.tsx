import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, Package, Pencil, Plus, Power, Search, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Segmented, Td, Th, useAction } from '../../components/ui'
import { dateOnly, num } from '../../lib/format'
import type { Merchant } from '../../lib/types'
import { MerchantDrawer, MerchantFormDialog, OrderDrawer } from './dialogs'

export default function Merchants() {
  const { merchants, orders, setMerchantStatus } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [form, setForm] = useState<{ open: boolean; merchant?: Merchant }>({ open: params.get('new') === '1' })
  const [viewId, setViewId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [toggle, setToggle] = useState<Merchant | null>(null)
  const { run, isPending } = useAction()

  const closeForm = () => {
    setForm({ open: false })
    if (params.get('new')) setParams({}, { replace: true })
  }

  const term = q.trim()
  const rows = merchants.filter(
    (m) => (status === 'all' || m.status === status) && (!term || [m.name, m.ownerName, m.phone, m.area, m.category].some((v) => v.includes(term))),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو المسؤول أو الهاتف أو المنطقة" className="ps-9" />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'الكل', count: merchants.length },
            { value: 'active', label: 'نشط', count: merchants.filter((m) => m.status === 'active').length },
            { value: 'inactive', label: 'موقوف', count: merchants.filter((m) => m.status === 'inactive').length },
          ]}
        />
        <Button className="ms-auto" onClick={() => setForm({ open: true })}><Plus className="size-4" /> إضافة تاجر</Button>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<Store className="size-5" />} title="لا يوجد تجار مطابقون" description="جرّب تعديل البحث أو الفلتر، أو أضف تاجراً جديداً." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <Th>التاجر</Th><Th>الفئة</Th><Th>المسؤول</Th><Th>الهاتف</Th><Th>العنوان</Th><Th>الطلبات</Th><Th>الحالة</Th><Th>تاريخ الإنشاء</Th><Th className="text-end">إجراءات</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <Td>
                      <button className="flex cursor-pointer items-center gap-3 text-start" onClick={() => setViewId(m.id)}>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-navy-900 text-sm font-bold text-brand-500">{m.name.split(' ').at(-1)?.[0]}</span>
                        <span className="font-medium text-slate-800 hover:text-brand-700">{m.name}</span>
                      </button>
                    </Td>
                    <Td><Badge>{m.category}</Badge></Td>
                    <Td>{m.ownerName}</Td>
                    <Td><span dir="ltr">{m.phone}</span></Td>
                    <Td className="max-w-56 truncate text-slate-600">{m.address}</Td>
                    <Td>{num(orders.filter((o) => o.merchantId === m.id).length)}</Td>
                    <Td>{m.status === 'active' ? <Badge tone="green" dot>نشط</Badge> : <Badge tone="red" dot>موقوف</Badge>}</Td>
                    <Td className="text-slate-500">{dateOnly(m.createdAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="عرض التفاصيل" aria-label="عرض التفاصيل" onClick={() => setViewId(m.id)}><Eye className="size-4" /></Button>
                        <Button variant="ghost" size="icon" title="طلبات التاجر" aria-label="طلبات التاجر" onClick={() => navigate(`/admin/orders?merchant=${m.id}`)}><Package className="size-4" /></Button>
                        <Button variant="ghost" size="icon" title="تعديل" aria-label="تعديل" onClick={() => setForm({ open: true, merchant: m })}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" title={m.status === 'active' ? 'إيقاف' : 'تفعيل'} aria-label={m.status === 'active' ? 'إيقاف' : 'تفعيل'} className={m.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-brand-600 hover:bg-brand-50'} onClick={() => setToggle(m)}><Power className="size-4" /></Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form.open && <MerchantFormDialog open onClose={closeForm} merchant={form.merchant} />}
      <MerchantDrawer merchantId={viewId} onClose={() => setViewId(null)} onOpenOrder={setOrderId} />
      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} />
      <ConfirmDialog
        open={!!toggle}
        onClose={() => setToggle(null)}
        loading={isPending('toggle')}
        tone={toggle?.status === 'active' ? 'danger' : 'brand'}
        title={toggle?.status === 'active' ? `إيقاف حساب ${toggle?.name}؟` : `تفعيل حساب ${toggle?.name}؟`}
        description={toggle?.status === 'active' ? 'لن يتمكن التاجر من الدخول أو إنشاء طلبات جديدة. الطلبات الجارية لا تتأثر.' : 'سيتمكن التاجر من الدخول وطلب الكباتن مجدداً.'}
        confirmLabel={toggle?.status === 'active' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
        onConfirm={() =>
          run('toggle', () => {
            if (!toggle) return
            setMerchantStatus(toggle.id, toggle.status === 'active' ? 'inactive' : 'active')
            toast.success(toggle.status === 'active' ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب')
            setToggle(null)
          })
        }
      />
    </div>
  )
}
