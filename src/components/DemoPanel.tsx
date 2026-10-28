import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FlaskConical, MapPin, Play, Radio, RotateCcw, WifiOff, X } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../store/useStore'
import { activeOrderOf, gpsHealthy, walletOf } from '../lib/rules'
import { money } from '../lib/format'
import type { Role } from '../lib/types'
import { cn } from '../lib/cn'
import { Button, ConfirmDialog, Select, Switch } from './ui'

type ScenarioKey = 'A' | 'B' | 'C' | 'D'

const SCENARIOS: Record<ScenarioKey, { title: string; steps: string[] }> = {
  A: {
    title: 'توصيل قياسي كامل',
    steps: [
      'الإدارة ← التجار ← أضف تاجراً جديداً (يفتح النموذج تلقائياً).',
      'الإدارة ← الكباتن ← أضف كابتناً جديداً.',
      'اشحن محفظة الكابتن الجديد من زر المحفظة.',
      'بدّل إلى التاجر الجديد (من القائمة أدناه) واطلب كابتناً.',
      'بدّل إلى الكابتن الجديد، فعّل التوفر، واقبل الطلب.',
      'تحقق من التعيين لدى التاجر والإدارة.',
      'أكمل مراحل التوصيل حتى التسليم.',
      'راجع سجل الطلبات وخصم المحفظة.',
    ],
  },
  B: {
    title: 'رصيد محفظة غير كافٍ',
    steps: [
      'أنت الآن الكابتن A برصيد 0 د.أ – لا تظهر أي طلبات.',
      'بدّل إلى الإدارة ← محافظ الكباتن واشحن محفظة A.',
      'عد إلى الكابتن A: تظهر الطلبات المؤهلة فوراً.',
      'جرّب الكابتن B (1 د.أ): لا يرى طلب 2 د.أ. والكابتن C (5 د.أ) يراه.',
    ],
  },
  C: {
    title: 'التوجيه الخاص',
    steps: [
      'تم إيقاف البث العام. أنت الآن التاجر – أرسل طلب كابتن.',
      'بدّل إلى الإدارة ← طلبات التوصيل ← قائمة التوجيه.',
      'اضغط «توجيه» واختر كابتناً مؤهلاً (مثلاً D).',
      'بدّل إلى ذلك الكابتن: يرى العرض الحصري وحده.',
      'اقبل أو ارفض، ثم راجع النتيجة لدى الإدارة.',
      'أعد تفعيل البث من الإعدادات أو من هذه اللوحة.',
    ],
  },
  D: {
    title: 'انقطاع إشارة GPS',
    steps: [
      'أنت الآن الكابتن E أثناء توصيلة نشطة.',
      'اضغط «محاكاة فقدان GPS» أدناه أو في شاشة التوصيل.',
      'لاحظ التحذير، والموقع القديم في الخريطة الحية للإدارة.',
      'اضغط «محاكاة عودة GPS» ثم أكمل التوصيل.',
    ],
  },
}

export function DemoPanel() {
  const [open, setOpen] = useState(false)
  const [scenario, setScenario] = useState<ScenarioKey | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const s = useStore()
  const { session, captains, merchants, txs, orders, settings, demoCaptainId } = s
  const dc = captains.find((c) => c.id === demoCaptainId)
  const onCaptainRoute = location.pathname.startsWith('/captain')

  const go = (role: Role, id?: string) => {
    s.login(role, id)
    navigate(`/${role}`)
  }

  const start = (k: ScenarioKey) => {
    setScenario(k)
    const byCode = (code: string) => captains.find((c) => c.code === code)
    if (k === 'A') {
      s.login('admin')
      navigate('/admin/merchants?new=1')
    }
    if (k === 'B') {
      if (!settings.publicBroadcasting) s.setBroadcasting(true)
      const a = byCode('A')
      if (!a) return toast.error('الكابتن A غير موجود – أعد تعيين البيانات.')
      s.setDemoCaptain(a.id)
      go('captain', a.id)
    }
    if (k === 'C') {
      if (settings.publicBroadcasting) s.setBroadcasting(false)
      s.login('merchant', merchants.find((m) => m.status === 'active')?.id)
      navigate('/merchant/request')
    }
    if (k === 'D') {
      const busy = captains.find((c) => activeOrderOf(orders, c.id) && c.status === 'active')
      if (!busy) return toast.error('لا يوجد كابتن في توصيلة نشطة. ابدأ توصيلة أولاً أو أعد تعيين البيانات.')
      if (!gpsHealthy(busy)) s.setGpsLost(busy.id, false)
      s.setDemoCaptain(busy.id)
      go('captain', busy.id)
      navigate('/captain/active')
    }
    toast.info(`بدأ السيناريو: ${SCENARIOS[k].title}`)
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed left-4 z-[950] flex items-center gap-2 rounded-full border border-dashed border-amber-400 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 shadow-lg hover:bg-amber-100',
          onCaptainRoute ? 'bottom-24' : 'bottom-4',
        )}
        aria-expanded={open}
      >
        <FlaskConical className="size-4" /> أدوات العرض
      </button>

      {open && (
        <div className={cn('fixed left-4 z-[950] flex max-h-[80vh] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-2xl', onCaptainRoute ? 'bottom-36' : 'bottom-16')} dir="rtl">
          <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><FlaskConical className="size-4" /> لوحة المقدّم</div>
              <div className="text-[11px] text-amber-700">أدوات محاكاة للعرض فقط – ليست جزءاً من المنتج</div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-amber-700 hover:bg-amber-100" aria-label="إغلاق"><X className="size-4" /></button>
          </div>

          <div className="scrollbar-thin space-y-4 overflow-y-auto p-4 text-sm">
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400">تبديل الدور</h4>
              <div className="grid grid-cols-3 gap-1.5">
                {(['admin', 'merchant', 'captain'] as Role[]).map((r) => (
                  <Button key={r} size="sm" variant={session?.role === r ? 'primary' : 'outline'} onClick={() => go(r, r === 'captain' ? demoCaptainId : r === 'merchant' ? session?.merchantId ?? undefined : undefined)}>
                    {r === 'admin' ? 'الإدارة' : r === 'merchant' ? 'التاجر' : 'الكابتن'}
                  </Button>
                ))}
              </div>
              <Select className="h-9 text-xs" value={session?.role === 'merchant' ? session.merchantId ?? '' : ''} onChange={(e) => e.target.value && go('merchant', e.target.value)} aria-label="التاجر">
                <option value="">— الدخول كتاجر محدد —</option>
                {merchants.map((m) => <option key={m.id} value={m.id} disabled={m.status !== 'active'}>{m.name}{m.status !== 'active' ? ' (موقوف)' : ''}</option>)}
              </Select>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400">الكابتن التجريبي</h4>
              <Select className="h-9 text-xs" value={demoCaptainId} onChange={(e) => { s.setDemoCaptain(e.target.value); if (session?.role === 'captain') toast.success('تم تبديل الكابتن') }} aria-label="الكابتن">
                {captains.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} · {money(walletOf(txs, c.id).available)}</option>)}
              </Select>
              {dc && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <label className="flex items-center justify-between text-xs">
                    <span>متاح لاستقبال الطلبات</span>
                    <Switch checked={dc.available} onChange={(v) => { const r = s.setAvailability(dc.id, v); if (!r.ok) toast.error(r.error) }} label="التوفر" />
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => { const r = s.simulateGpsStep(dc.id); r.ok ? toast('تم تحديث الموقع (محاكاة)') : toast.error(r.error) }}><MapPin className="size-3.5" /> تحديث الموقع</Button>
                    <Button size="sm" variant={gpsHealthy(dc) ? 'outline' : 'danger'} onClick={() => { if (dc.gpsMode === 'off') s.setGpsMode(dc.id, 'demo'); else s.setGpsLost(dc.id, gpsHealthy(dc)) }}>
                      <WifiOff className="size-3.5" /> {dc.gpsMode === 'off' ? 'تفعيل الموقع' : gpsHealthy(dc) ? 'محاكاة فقدان GPS' : 'محاكاة عودة GPS'}
                    </Button>
                  </div>
                  {session?.role !== 'captain' && <Button size="sm" variant="ghost" className="w-full" onClick={() => go('captain', dc.id)}>فتح واجهة هذا الكابتن</Button>}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400">التشغيل</h4>
              <label className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><Radio className="size-3.5" /> البث العام للطلبات</span>
                <Switch checked={settings.publicBroadcasting} onChange={(v) => { const r = s.setBroadcasting(v); toast.success(v ? 'تم استئناف البث' : 'تم إيقاف البث', { description: r.moved ? `${r.moved} طلب تأثر` : undefined }) }} label="البث العام" />
              </label>
              <label className="flex items-center justify-between text-xs">
                <span>تحريك الكباتن تلقائياً (محاكاة)</span>
                <Switch checked={settings.autoSimulateMovement} onChange={(v) => s.setSetting('autoSimulateMovement', v)} label="الحركة التلقائية" />
              </label>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400">سيناريوهات العرض</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
                  <Button key={k} size="sm" variant={scenario === k ? 'brand' : 'outline'} className="justify-start" onClick={() => start(k)}>
                    <Play className="size-3" /> {k} · {SCENARIOS[k].title}
                  </Button>
                ))}
              </div>
              {scenario && (
                <ol className="list-inside list-decimal space-y-1 rounded-xl border border-brand-100 bg-brand-50/50 p-3 text-xs leading-relaxed text-slate-700">
                  {SCENARIOS[scenario].steps.map((st) => <li key={st}>{st}</li>)}
                </ol>
              )}
            </section>

            <section className="border-t border-slate-100 pt-3">
              <Button size="sm" variant="outline" className="w-full text-rose-600" onClick={() => setConfirmReset(true)}><RotateCcw className="size-3.5" /> إعادة تعيين البيانات التجريبية</Button>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">البيانات محفوظة في هذا المتصفح فقط ولا تتزامن مع أجهزة أخرى.</p>
            </section>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { s.resetDemo(); setScenario(null); setConfirmReset(false); toast.success('تمت إعادة تعيين البيانات التجريبية') }}
        title="إعادة تعيين البيانات؟"
        description="ستُحذف جميع التغييرات وتعود البيانات الأولية (6 تجار، 8 كباتن، 15 طلباً)."
        confirmLabel="إعادة التعيين"
        tone="danger"
      />
    </>
  )
}
