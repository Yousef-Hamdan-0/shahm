import { Info, Wallet as WalletIcon } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Badge, Card, EmptyState } from '../../components/ui'
import { TX_META } from '../../components/shared'
import { dateTime, money } from '../../lib/format'
import { WALLET_EMPTY_MSG, walletOf } from '../../lib/rules'
import { useCaptain } from './CaptainLayout'

export default function Wallet() {
  const captain = useCaptain()!
  const txs = useStore((s) => s.txs)
  const w = walletOf(txs, captain.id)
  const list = txs.filter((t) => t.captainId === captain.id).sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="bg-navy-900 p-5 text-white">
          <div className="text-sm text-white/60">الرصيد المتاح</div>
          <div className="mt-1 text-4xl font-bold">{money(w.available)}</div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-100">
          <div className="p-4"><div className="text-xs text-slate-500">محجوز لطلبات جارية</div><div className="mt-1 font-semibold text-navy-900">{money(w.reserved)}</div></div>
          <div className="p-4"><div className="text-xs text-slate-500">إجمالي الرصيد</div><div className="mt-1 font-semibold text-navy-900">{money(w.total)}</div></div>
        </div>
      </Card>

      {w.available <= 0 && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{WALLET_EMPTY_MSG}</p>}
      <p className="flex gap-2 rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600">
        <Info className="size-4 shrink-0" /> شحن المحفظة يتم من خلال الإدارة فقط. تُحجز رسوم الطلب عند القبول وتُخصم عند التسليم، ويُحرَّر الحجز إذا أُلغي الطلب. (أرصدة تجريبية)
      </p>

      <h3 className="pt-2 font-semibold text-navy-900">سجل العمليات</h3>
      {list.length === 0 ? (
        <Card><EmptyState icon={<WalletIcon className="size-6" />} title="لا توجد عمليات بعد" /></Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Badge tone={TX_META[t.type].tone}>{TX_META[t.type].label}</Badge>
                <div className="mt-1 truncate text-xs text-slate-500">{t.note}</div>
                <div className="text-[11px] text-slate-400">{dateTime(t.createdAt)}</div>
              </div>
              <span className={`font-semibold ${t.type === 'recharge' || t.type === 'release' ? 'text-brand-600' : 'text-slate-700'}`} dir="ltr">
                {TX_META[t.type].sign}{money(t.amount)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
