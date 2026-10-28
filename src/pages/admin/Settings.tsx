import { useState } from 'react'
import { Database, Info, Lock, Radio, RotateCcw, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Badge, Button, Card, CardHeader, ConfirmDialog, Select, Switch, useAction } from '../../components/ui'
import { num } from '../../lib/format'

export default function Settings() {
  const { settings, orders, setBroadcasting, setSetting, resetDemo } = useStore()
  const [confirm, setConfirm] = useState<'off' | 'on' | 'reset' | null>(null)
  const { run, isPending } = useAction()
  const awaiting = orders.filter((o) => o.status === 'awaiting_captain').length
  const paused = orders.filter((o) => o.status === 'pending_dispatch' && o.pausedByBroadcast).length

  const apply = (on: boolean) =>
    run('broadcast', () => {
      const r = setBroadcasting(on)
      toast.success(on ? 'تم استئناف البث العام' : 'تم إيقاف البث العام', {
        description: r.moved ? (on ? `أُعيد نشر ${num(r.moved)} طلب للكباتن.` : `نُقل ${num(r.moved)} طلب إلى قائمة الانتظار.`) : undefined,
      })
      setConfirm(null)
    })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader title="البث العام للطلبات" description="التحكم في ظهور الطلبات الجديدة في قائمة الطلبات العامة للكباتن" action={settings.publicBroadcasting ? <Badge tone="green" dot>مفعّل</Badge> : <Badge tone="amber" dot>متوقف</Badge>} />
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <Radio className="mt-0.5 size-5 text-navy-700" />
              <div>
                <div className="font-medium text-slate-800">نشر الطلبات للكباتن المؤهلين</div>
                <div className="text-sm text-slate-500">عند الإيقاف تنتقل الطلبات غير المقبولة إلى قائمة انتظار الإدارة.</div>
              </div>
            </div>
            <Switch size="lg" checked={settings.publicBroadcasting} onChange={(v) => setConfirm(v ? 'on' : 'off')} label="البث العام" disabled={isPending('broadcast')} />
          </div>
          <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <li className="flex gap-2 rounded-lg border border-slate-100 p-3"><Lock className="size-4 shrink-0 text-violet-600" /> التوجيه الخاص يبقى متاحاً دائماً بغض النظر عن حالة البث.</li>
            <li className="flex gap-2 rounded-lg border border-slate-100 p-3"><Info className="size-4 shrink-0 text-sky-600" /> إيقاف البث لا يلغي أي توصيلة جارية.</li>
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="التوجيه الخاص" />
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <Timer className="mt-0.5 size-5 text-navy-700" />
            <div>
              <div className="font-medium text-slate-800">مهلة العرض الحصري</div>
              <div className="text-sm text-slate-500">بعد انتهائها يعود الطلب إلى قائمة الإدارة ولا يُنشر تلقائياً.</div>
            </div>
          </div>
          <Select className="w-32" value={settings.privateOfferTtlMin} onChange={(e) => { setSetting('privateOfferTtlMin', Number(e.target.value)); toast.success('تم حفظ المهلة') }} aria-label="مهلة العرض">
            {[1, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m} دقائق</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        <CardHeader title="بيانات العرض التجريبي" />
        <div className="space-y-4 p-5">
          <p className="flex gap-2 text-sm leading-relaxed text-slate-600">
            <Database className="mt-0.5 size-4 shrink-0" />
            تُحفظ البيانات في متصفح هذا الجهاز فقط (localStorage). تنعكس التغييرات فوراً بين واجهات الأدوار داخل نفس المتصفح، لكنها لا تتزامن مع أجهزة أخرى. يتطلب العرض عبر أجهزة متعددة خادماً مشتركاً وخدمة تحديث لحظي.
          </p>
          <Button variant="outline" onClick={() => setConfirm('reset')}><RotateCcw className="size-4" /> إعادة تعيين البيانات التجريبية</Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirm === 'off'}
        onClose={() => setConfirm(null)}
        onConfirm={() => apply(false)}
        loading={isPending('broadcast')}
        title="إيقاف البث العام؟"
        description={`سيُنقل ${num(awaiting)} طلب منشور غير مقبول إلى قائمة انتظار الإدارة. التوصيلات الجارية والتوجيه الخاص لن يتأثرا.`}
        confirmLabel="إيقاف البث"
        tone="danger"
      />
      <ConfirmDialog
        open={confirm === 'on'}
        onClose={() => setConfirm(null)}
        onConfirm={() => apply(true)}
        loading={isPending('broadcast')}
        title="استئناف البث العام؟"
        description={`سيُعاد نشر ${num(paused)} طلب أُوقف بسبب البث. الطلبات التي رفضها كابتن أو انتهت مهلتها تبقى في قائمة الإدارة.`}
        confirmLabel="استئناف البث"
        tone="brand"
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() => run('reset', () => { resetDemo(); toast.success('تمت إعادة تعيين البيانات التجريبية'); setConfirm(null) })}
        loading={isPending('reset')}
        title="إعادة تعيين البيانات؟"
        description="سيتم حذف جميع التغييرات (تجار، كباتن، طلبات، عمليات محفظة) والعودة للبيانات الأولية."
        confirmLabel="إعادة التعيين"
        tone="danger"
      />
    </div>
  )
}
