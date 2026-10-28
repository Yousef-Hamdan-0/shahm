import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, MapPin, Phone, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Button, Card, Field, Input, KeyVal, Select, Textarea, useAction } from '../../components/ui'
import { MapView } from '../../components/MapView'
import { LocationPicker } from '../../components/LocationPicker'
import { AMMAN_AREAS, jodToFils, money } from '../../lib/format'
import { AREA_COORDS } from '../../lib/seed'
import { cn } from '../../lib/cn'
import { useMerchant } from './MerchantLayout'

const STEPS = ['بيانات العميل', 'تفاصيل التوصيل', 'التأكيد']
const PHONE_RE = /^07[789]\d{7}$/

export default function RequestCaptain() {
  const merchant = useMerchant()!
  const createOrder = useStore((s) => s.createOrder)
  const broadcasting = useStore((s) => s.settings.publicBroadcasting)
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<{ id: string; ref: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { run, isPending } = useAction()
  const defaultArea = AMMAN_AREAS.find((a) => a !== merchant.area) ?? AMMAN_AREAS[0]
  const [f, setF] = useState({
    customerName: '',
    customerPhone: '',
    area: defaultArea,
    street: '',
    lat: AREA_COORDS[defaultArea][0],
    lng: AREA_COORDS[defaultArea][1],
    locationNotes: '',
    fee: '2',
    instructions: '',
    merchantRef: '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }

  const validate = (s: number) => {
    const er: Record<string, string> = {}
    if (s === 0) {
      if (!PHONE_RE.test(f.customerPhone)) er.customerPhone = 'أدخل رقم هاتف أردني صحيح (10 خانات يبدأ بـ 07).'
      if (f.street.trim().length < 3) er.street = 'أدخل عنوان التوصيل.'
    }
    if (s === 1) {
      const fee = Number(f.fee)
      if (!(fee > 0)) er.fee = 'أدخل رسوم توصيل أكبر من صفر.'
      else if (fee > 50) er.fee = 'الحد الأعلى 50 د.أ.'
    }
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const next = () => validate(step) && setStep((s) => s + 1)
  const submit = () =>
    run('submit', () => {
      const r = createOrder(
        {
          merchantId: merchant.id,
          customerName: f.customerName.trim(),
          customerPhone: f.customerPhone,
          dropoffArea: f.area,
          dropoffAddress: `${f.area}، ${f.street.trim()}`,
          dropoffLat: f.lat,
          dropoffLng: f.lng,
          locationNotes: f.locationNotes.trim(),
          fee: jodToFils(Number(f.fee)),
          instructions: f.instructions.trim(),
          merchantRef: f.merchantRef.trim(),
        },
        'merchant',
      )
      if (!r.ok) return void toast.error(r.error)
      setDone({ id: r.id!, ref: r.ref! })
    }, 700)

  if (done)
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"><CheckCircle2 className="size-9" /></div>
        <h1 className="mt-4 text-2xl font-bold text-navy-900">تم إرسال طلبك بنجاح</h1>
        <p className="mt-1 text-slate-500">رقم الطلب <b className="text-navy-900">{done.ref}</b></p>
        <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-xl bg-slate-50 p-3 text-start text-sm text-slate-600">
          <Clock className="mt-0.5 size-4 shrink-0" />
          {broadcasting ? 'جاري البحث عن كابتن متاح بالقرب منك. ستصلك حالة الطلب هنا فور قبوله.' : 'طلبك قيد المعالجة وسيقوم فريق العمليات بتعيين كابتن له قريباً.'}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => navigate(`/merchant/orders/${done.id}`)}>تتبع الطلب</Button>
          <Button size="lg" variant="outline" onClick={() => { setDone(null); setStep(0); setF((p) => ({ ...p, customerName: '', customerPhone: '', street: '', locationNotes: '', instructions: '', merchantRef: '' })) }}>طلب كابتن آخر</Button>
        </div>
      </Card>
    )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">طلب كابتن</h1>
        <Link to="/merchant" className="text-sm text-slate-500 hover:text-navy-900">إلغاء</Link>
      </div>

      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold', i < step ? 'bg-brand-500 text-white' : i === step ? 'bg-navy-900 text-white' : 'bg-slate-200 text-slate-500')}>
              {i < step ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn('hidden text-sm sm:block', i === step ? 'font-medium text-navy-900' : 'text-slate-400')}>{s}</span>
            {i < STEPS.length - 1 && <span className={cn('h-0.5 flex-1 rounded', i < step ? 'bg-brand-500' : 'bg-slate-200')} />}
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رقم هاتف العميل" required error={errors.customerPhone}>
                {(id) => <Input id={id} dir="ltr" inputMode="tel" autoFocus className="h-12 text-lg" value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} aria-invalid={!!errors.customerPhone} placeholder="07XXXXXXXX" />}
              </Field>
              <Field label="اسم العميل" hint="اختياري">{(id) => <Input id={id} className="h-12" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} />}</Field>
              <Field label="المنطقة" required>
                {(id) => (
                  <Select id={id} className="h-12" value={f.area} onChange={(e) => { const a = e.target.value; setF((p) => ({ ...p, area: a, lat: AREA_COORDS[a][0], lng: AREA_COORDS[a][1] })) }}>
                    {AMMAN_AREAS.map((a) => <option key={a}>{a}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="عنوان التوصيل" required error={errors.street}>{(id) => <Input id={id} className="h-12" value={f.street} onChange={(e) => set('street', e.target.value)} aria-invalid={!!errors.street} placeholder="الشارع، رقم البناية، الطابق" />}</Field>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">موقع التوصيل على الخريطة</p>
              <LocationPicker lat={f.lat} lng={f.lng} onChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))} />
            </div>
            <Field label="ملاحظات الموقع" hint="اختياري">{(id) => <Input id={id} value={f.locationNotes} onChange={(e) => set('locationNotes', e.target.value)} placeholder="مثال: بجانب صيدلية، المدخل الخلفي" />}</Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <Store className="mt-0.5 size-5 text-navy-700" />
              <div className="text-sm">
                <div className="text-xs text-slate-500">موقع الاستلام (تلقائي من بيانات المتجر)</div>
                <div className="mt-0.5 font-medium text-slate-800">{merchant.name}</div>
                <div className="text-slate-600">{merchant.address}</div>
              </div>
            </div>
            <Field label="رسوم التوصيل (د.أ)" required error={errors.fee}>
              {(id) => (
                <div className="space-y-2">
                  <Input id={id} dir="ltr" type="number" min={0.5} step={0.5} className="h-12 text-lg" value={f.fee} onChange={(e) => set('fee', e.target.value)} aria-invalid={!!errors.fee} />
                  <div className="flex gap-2">
                    {['1.5', '2', '2.5', '3'].map((v) => (
                      <Button key={v} size="sm" variant={f.fee === v ? 'primary' : 'outline'} onClick={() => set('fee', v)}>{v} د.أ</Button>
                    ))}
                  </div>
                </div>
              )}
            </Field>
            <Field label="تعليمات التوصيل" hint="اختياري">{(id) => <Textarea id={id} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="مثال: الطلب يحتوي على مشروبات ساخنة" />}</Field>
            <Field label="مرجع الطلب لديك" hint="اختياري · رقم الفاتورة أو الطلب في نظامك">{(id) => <Input id={id} dir="ltr" value={f.merchantRef} onChange={(e) => set('merchantRef', e.target.value)} placeholder="INV-0000" />}</Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <MapView
              className="h-56"
              fit
              markers={[
                { id: 'p', lat: merchant.lat, lng: merchant.lng, kind: 'pickup' },
                { id: 'd', lat: f.lat, lng: f.lng, kind: 'dropoff' },
              ]}
              routes={[{ points: [[merchant.lat, merchant.lng], [f.lat, f.lng]], dashed: true }]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-blue-600"><Store className="size-3.5" /> الاستلام</div>
                <div className="text-sm font-medium">{merchant.name}</div>
                <div className="text-sm text-slate-500">{merchant.address}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-rose-600"><MapPin className="size-3.5" /> التسليم</div>
                <div className="text-sm font-medium">{f.customerName || 'عميل'}</div>
                <div className="text-sm text-slate-500">{f.area}، {f.street}</div>
                {f.locationNotes && <div className="mt-1 text-xs text-slate-400">{f.locationNotes}</div>}
              </div>
            </div>
            <div className="divide-y divide-slate-100 rounded-xl bg-slate-50 px-4">
              <KeyVal label="هاتف العميل"><span dir="ltr" className="inline-flex items-center gap-1"><Phone className="size-3" />{f.customerPhone}</span></KeyVal>
              <KeyVal label="رسوم التوصيل"><span className="text-lg text-navy-900">{money(jodToFils(Number(f.fee)))}</span></KeyVal>
              {f.instructions && <KeyVal label="التعليمات">{f.instructions}</KeyVal>}
              {f.merchantRef && <KeyVal label="مرجع الطلب">{f.merchantRef}</KeyVal>}
            </div>
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={isPending('submit')}><ArrowRight className="size-4" /> السابق</Button>
        )}
        {step < 2 ? (
          <Button size="lg" className="flex-1" onClick={next}>التالي <ArrowLeft className="size-4" /></Button>
        ) : (
          <Button size="lg" variant="brand" className="flex-1" onClick={submit} loading={isPending('submit')}><Check className="size-5" /> تأكيد وطلب الكابتن</Button>
        )}
      </div>
    </div>
  )
}
