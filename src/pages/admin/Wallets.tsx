import { useState } from 'react'
import { Info, Wallet } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Badge, Button, Card, CardHeader, EmptyState, Select, Td, Th } from '../../components/ui'
import { TX_META } from '../../components/shared'
import { dateTime, money } from '../../lib/format'
import { walletOf } from '../../lib/rules'
import type { Captain, WalletTxType } from '../../lib/types'
import { RechargeDialog } from './dialogs'

export default function Wallets() {
  const { captains, txs } = useStore()
  const [recharge, setRecharge] = useState<Captain | null>(null)
  const [captainFilter, setCaptainFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | WalletTxType>('')

  const totals = captains.reduce(
    (acc, c) => {
      const w = walletOf(txs, c.id)
      return { available: acc.available + w.available, reserved: acc.reserved + w.reserved, total: acc.total + w.total }
    },
    { available: 0, reserved: 0, total: 0 },
  )
  const list = txs
    .filter((t) => (!captainFilter || t.captainId === captainFilter) && (!typeFilter || t.type === typeFilter))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 60)

  return (
    <div className="space-y-6">
      <p className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-navy-700" />
        المحفظة رصيد مسبق الدفع يغطي رسوم خدمة شهم (افتراض لأغراض العرض). جميع عمليات الشحن هنا أرصدة تجريبية ولا تمثل أي تحويل مالي حقيقي. يُشترط أن يكون الرصيد المتاح مساوياً لرسوم الطلب أو أكبر منها حتى يظهر للكابتن.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[['إجمالي الأرصدة المتاحة', totals.available], ['إجمالي المحجوز', totals.reserved], ['إجمالي الأرصدة', totals.total]].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <div className="text-xs text-slate-500">{l}</div>
            <div className="mt-2 text-2xl font-bold text-navy-900">{money(v as number)}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="أرصدة الكباتن" />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/60"><tr><Th>الكابتن</Th><Th>الرصيد المتاح</Th><Th>المحجوز</Th><Th>الإجمالي</Th><Th>آخر عملية</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {captains.map((c) => {
                const w = walletOf(txs, c.id)
                const last = txs.filter((t) => t.captainId === c.id).sort((a, b) => b.createdAt - a.createdAt)[0]
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{c.code}</span>
                        <span className="font-medium">{c.name}</span>
                        {c.status !== 'active' && <Badge tone="red">موقوف</Badge>}
                      </div>
                    </Td>
                    <Td><span className={w.available <= 0 ? 'font-semibold text-rose-600' : 'font-semibold text-navy-900'}>{money(w.available)}</span></Td>
                    <Td className="text-slate-600">{money(w.reserved)}</Td>
                    <Td className="text-slate-600">{money(w.total)}</Td>
                    <Td className="text-xs text-slate-500">{last ? `${TX_META[last.type].label} · ${dateTime(last.createdAt)}` : '—'}</Td>
                    <Td className="text-end"><Button size="sm" variant="soft" onClick={() => setRecharge(c)}><Wallet className="size-3.5" /> شحن</Button></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="أحدث العمليات"
          action={
            <div className="flex gap-2">
              <Select value={captainFilter} onChange={(e) => setCaptainFilter(e.target.value)} className="h-9 w-44 text-xs" aria-label="الكابتن">
                <option value="">جميع الكباتن</option>
                {captains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as WalletTxType | '')} className="h-9 w-40 text-xs" aria-label="نوع العملية">
                <option value="">جميع الأنواع</option>
                {Object.entries(TX_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </div>
          }
        />
        {list.length === 0 ? (
          <EmptyState icon={<Wallet className="size-5" />} title="لا توجد عمليات" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/60"><tr><Th>التاريخ</Th><Th>الكابتن</Th><Th>النوع</Th><Th>الوصف</Th><Th>المبلغ</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((t) => (
                  <tr key={t.id}>
                    <Td className="text-slate-500">{dateTime(t.createdAt)}</Td>
                    <Td>{captains.find((c) => c.id === t.captainId)?.name}</Td>
                    <Td><Badge tone={TX_META[t.type].tone}>{TX_META[t.type].label}</Badge></Td>
                    <Td className="text-slate-600">{t.note}</Td>
                    <Td className="font-medium" ><span dir="ltr">{TX_META[t.type].sign}{money(t.amount)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {recharge && <RechargeDialog captain={recharge} onClose={() => setRecharge(null)} />}
    </div>
  )
}
