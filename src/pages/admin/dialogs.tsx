import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Ban, Clock, Info, Lock, MapPin, Phone, Radio, Send, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useStore, type DispatchChoice } from '../../store/useStore'
import { Badge, Button, ConfirmDialog, Dialog, Drawer, Field, Input, KeyVal, Select, StarRating, Textarea, useAction } from '../../components/ui'
import { EventLog, GpsIndicator, OrderStatusBadge, PresenceBadge, captainPresence } from '../../components/shared'
import { LocationPicker } from '../../components/LocationPicker'
import { MapView, type MapMarker } from '../../components/MapView'
import { AMMAN_AREAS, CATEGORIES, VEHICLE_LABEL, dateTime, jodToFils, money, relative, timeOnly } from '../../lib/format'
import { AREA_COORDS } from '../../lib/seed'
import { canTransition, distanceKm, isActiveDelivery, orderBlockers, walletOf } from '../../lib/rules'
import type { Captain, Merchant, Order, VehicleType } from '../../lib/types'
import { useNow } from '../../lib/useNow'
import { cn } from '../../lib/cn'

const PHONE_RE = /^07[789]\d{7}$/
const avgRating = (c: Captain) => (c.ratings.length ? c.ratings.reduce((s, r) => s + r.stars, 0) / c.ratings.length : 0)
export { avgRating }

// ---------------------------------------------------------------------------
// Merchant form
// ---------------------------------------------------------------------------

export function MerchantFormDialog({ open, onClose, merchant }: { open: boolean; onClose: () => void; merchant?: Merchant }) {
  const { addMerchant, updateMerchant } = useStore()
  const [f, setF] = useState(() => ({
    name: merchant?.name ?? '',
    category: merchant?.category ?? CATEGORIES[0],
    ownerName: merchant?.ownerName ?? '',
    phone: merchant?.phone ?? '',
    area: merchant?.area ?? AMMAN_AREAS[0],
    street: merchant ? merchant.address.replace(`${merchant.area}، `, '') : '',
    lat: merchant?.lat ?? AREA_COORDS[AMMAN_AREAS[0]][0],
    lng: merchant?.lng ?? AREA_COORDS[AMMAN_AREAS[0]][1],
    username: merchant?.username ?? '',
    password: merchant?.password ?? 'demo1234',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { run, isPending } = useAction()
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const er: Record<string, string> = {}
    if (f.name.trim().length < 2) er.name = 'أدخل اسم النشاط التجاري.'
    if (f.ownerName.trim().length < 2) er.ownerName = 'أدخل اسم المالك أو المسؤول.'
    if (!PHONE_RE.test(f.phone)) er.phone = 'رقم أردني من 10 خانات يبدأ بـ 077 أو 078 أو 079.'
    if (f.street.trim().length < 3) er.street = 'أدخل الشارع أو المعلم.'
    if (!/^[a-z0-9_.-]{3,}$/i.test(f.username)) er.username = '3 أحرف لاتينية على الأقل دون مسافات.'
    if (f.password.length < 6) er.password = '6 أحرف على الأقل.'
    setErrors(er)
    if (Object.keys(er).length) return
    run('save', () => {
      const payload = {
        name: f.name.trim(),
        category: f.category,
        ownerName: f.ownerName.trim(),
        phone: f.phone,
        area: f.area,
        address: `${f.area}، ${f.street.trim()}`,
        lat: f.lat,
        lng: f.lng,
        username: f.username.trim(),
        password: f.password,
      }
      const r = merchant ? updateMerchant(merchant.id, payload) : addMerchant(payload)
      if (!r.ok) {
        setErrors({ username: r.error! })
        return
      }
      toast.success(merchant ? 'تم تحديث بيانات التاجر' : `تمت إضافة ${payload.name}`, { description: merchant ? undefined : `بيانات الدخول: ${payload.username} / ${payload.password}` })
      onClose()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title={merchant ? 'تعديل بيانات التاجر' : 'إضافة تاجر جديد'} size="lg">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم النشاط التجاري" required error={errors.name}>{(id) => <Input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} placeholder="مثال: مطعم السنديان" />}</Field>
          <Field label="فئة النشاط" required>{(id) => <Select id={id} value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
          <Field label="اسم المالك / المسؤول" required error={errors.ownerName}>{(id) => <Input id={id} value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} aria-invalid={!!errors.ownerName} />}</Field>
          <Field label="رقم التواصل" required error={errors.phone}>{(id) => <Input id={id} dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} aria-invalid={!!errors.phone} placeholder="07XXXXXXXX" />}</Field>
          <Field label="المنطقة" required>
            {(id) => (
              <Select id={id} value={f.area} onChange={(e) => { const a = e.target.value; setF((p) => ({ ...p, area: a, lat: AREA_COORDS[a][0], lng: AREA_COORDS[a][1] })) }}>
                {AMMAN_AREAS.map((a) => <option key={a}>{a}</option>)}
              </Select>
            )}
          </Field>
          <Field label="العنوان التفصيلي" required error={errors.street}>{(id) => <Input id={id} value={f.street} onChange={(e) => set('street', e.target.value)} aria-invalid={!!errors.street} placeholder="الشارع، رقم البناية" />}</Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">إحداثيات موقع الاستلام</p>
          <LocationPicker lat={f.lat} lng={f.lng} kind="merchant" onChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))} className="h-52" />
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700"><Lock className="size-4" /> بيانات دخول تجريبية</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم المستخدم" required error={errors.username}>{(id) => <Input id={id} dir="ltr" value={f.username} onChange={(e) => set('username', e.target.value)} aria-invalid={!!errors.username} placeholder="merchant7" />}</Field>
            <Field label="كلمة المرور" required error={errors.password}>{(id) => <Input id={id} dir="ltr" value={f.password} onChange={(e) => set('password', e.target.value)} aria-invalid={!!errors.password} />}</Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" loading={isPending('save')}>{merchant ? 'حفظ التعديلات' : 'إضافة التاجر'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Captain form
// ---------------------------------------------------------------------------

export function CaptainFormDialog({ open, onClose, captain }: { open: boolean; onClose: () => void; captain?: Captain }) {
  const { addCaptain, updateCaptain } = useStore()
  const [f, setF] = useState(() => ({
    name: captain?.name ?? '',
    phone: captain?.phone ?? '',
    vehicleType: (captain?.vehicleType ?? 'motorcycle') as VehicleType,
    vehicleId: captain?.vehicleId ?? '',
    area: AMMAN_AREAS[2],
    username: captain?.username ?? '',
    password: captain?.password ?? 'demo1234',
    recharge: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { run, isPending } = useAction()
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const er: Record<string, string> = {}
    if (f.name.trim().split(/\s+/).length < 2) er.name = 'أدخل الاسم الكامل (اسمان على الأقل).'
    if (!PHONE_RE.test(f.phone)) er.phone = 'رقم أردني من 10 خانات يبدأ بـ 077 أو 078 أو 079.'
    if (f.vehicleId.trim().length < 3) er.vehicleId = 'أدخل رقم اللوحة أو المعرّف.'
    if (!/^[a-z0-9_.-]{3,}$/i.test(f.username)) er.username = '3 أحرف لاتينية على الأقل دون مسافات.'
    if (f.password.length < 6) er.password = '6 أحرف على الأقل.'
    const recharge = f.recharge ? Number(f.recharge) : 0
    if (!captain && (Number.isNaN(recharge) || recharge < 0)) er.recharge = 'أدخل مبلغاً صحيحاً أو اتركه فارغاً.'
    setErrors(er)
    if (Object.keys(er).length) return
    run('save', () => {
      const base = { name: f.name.trim(), phone: f.phone, vehicleType: f.vehicleType, vehicleId: f.vehicleId.trim(), username: f.username.trim(), password: f.password }
      const r = captain ? updateCaptain(captain.id, base) : addCaptain({ ...base, lat: AREA_COORDS[f.area][0], lng: AREA_COORDS[f.area][1] }, jodToFils(recharge))
      if (!r.ok) return setErrors({ username: r.error! })
      toast.success(captain ? 'تم تحديث بيانات الكابتن' : `تمت إضافة الكابتن ${base.name}`, { description: captain ? undefined : `بيانات الدخول: ${base.username} / ${base.password}` })
      onClose()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title={captain ? 'تعديل بيانات الكابتن' : 'إضافة كابتن جديد'} size="lg">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل" required error={errors.name}>{(id) => <Input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />}</Field>
          <Field label="رقم الهاتف" required error={errors.phone}>{(id) => <Input id={id} dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} aria-invalid={!!errors.phone} placeholder="07XXXXXXXX" />}</Field>
          <Field label="نوع المركبة" required>{(id) => <Select id={id} value={f.vehicleType} onChange={(e) => set('vehicleType', e.target.value as VehicleType)}>{Object.entries(VEHICLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="رقم اللوحة / المعرّف" required error={errors.vehicleId}>{(id) => <Input id={id} dir="ltr" value={f.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} aria-invalid={!!errors.vehicleId} placeholder="22-12345" />}</Field>
          {!captain && (
            <>
              <Field label="منطقة التمركز (موقع تجريبي مبدئي)">{(id) => <Select id={id} value={f.area} onChange={(e) => set('area', e.target.value)}>{AMMAN_AREAS.map((a) => <option key={a}>{a}</option>)}</Select>}</Field>
              <Field label="شحن رصيد افتتاحي (د.أ)" hint="اختياري · رصيد تجريبي وليس تحويلاً مالياً" error={errors.recharge}>{(id) => <Input id={id} dir="ltr" type="number" min={0} step={0.5} value={f.recharge} onChange={(e) => set('recharge', e.target.value)} placeholder="0" />}</Field>
            </>
          )}
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700"><Lock className="size-4" /> بيانات دخول تجريبية</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم المستخدم" required error={errors.username}>{(id) => <Input id={id} dir="ltr" value={f.username} onChange={(e) => set('username', e.target.value)} aria-invalid={!!errors.username} placeholder="captain9" />}</Field>
            <Field label="كلمة المرور" required error={errors.password}>{(id) => <Input id={id} dir="ltr" value={f.password} onChange={(e) => set('password', e.target.value)} aria-invalid={!!errors.password} />}</Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" loading={isPending('save')}>{captain ? 'حفظ التعديلات' : 'إضافة الكابتن'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Wallet recharge (simulated)
// ---------------------------------------------------------------------------

export function RechargeDialog({ captain, onClose }: { captain: Captain | null; onClose: () => void }) {
  const { txs, rechargeWallet } = useStore()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [stage, setStage] = useState<'form' | 'confirm'>('form')
  const [error, setError] = useState('')
  const { run, isPending } = useAction()
  if (!captain) return null
  const w = walletOf(txs, captain.id)
  const value = Number(amount)

  const next = () => {
    if (!amount || Number.isNaN(value) || value <= 0) return setError('أدخل مبلغاً موجباً أكبر من صفر.')
    if (value > 500) return setError('الحد الأقصى للشحن التجريبي 500 د.أ في العملية الواحدة.')
    if (Math.round(value * 1000) !== value * 1000) return setError('الحد الأقصى ثلاث خانات عشرية.')
    setError('')
    setStage('confirm')
  }
  const confirm = () =>
    run('recharge', () => {
      const r = rechargeWallet(captain.id, jodToFils(value), note)
      if (!r.ok) return setError(r.error!)
      toast.success(`تم شحن ${money(jodToFils(value))} لمحفظة ${captain.name}`, { description: 'تم تحديث أهلية الكابتن لاستقبال الطلبات فوراً.' })
      onClose()
    })

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={stage === 'form' ? 'شحن محفظة كابتن' : 'تأكيد عملية الشحن'}
      description={captain.name}
      footer={
        stage === 'form' ? (
          <>
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={next}>متابعة</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStage('form')} disabled={isPending('recharge')}>رجوع</Button>
            <Button variant="brand" onClick={confirm} loading={isPending('recharge')}>تأكيد الشحن</Button>
          </>
        )
      }
    >
      {stage === 'form' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
            <div><div className="text-slate-500">المتاح</div><div className="mt-0.5 font-semibold text-navy-900">{money(w.available)}</div></div>
            <div><div className="text-slate-500">المحجوز</div><div className="mt-0.5 font-semibold text-navy-900">{money(w.reserved)}</div></div>
            <div><div className="text-slate-500">الإجمالي</div><div className="mt-0.5 font-semibold text-navy-900">{money(w.total)}</div></div>
          </div>
          <Field label="المبلغ (د.أ)" required error={error}>
            {(id) => <Input id={id} dir="ltr" type="number" min={0} step={0.5} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error} placeholder="0.00" className="text-lg" />}
          </Field>
          <div className="flex gap-2">
            {[2, 5, 10, 20].map((v) => (
              <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))}>{v} د.أ</Button>
            ))}
          </div>
          <Field label="ملاحظة (اختياري)">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: دفعة نقدية في المكتب" />}</Field>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-brand-50 p-4 text-center">
            <div className="text-sm text-brand-700">سيتم إضافة</div>
            <div className="mt-1 text-3xl font-bold text-navy-900">{money(jodToFils(value))}</div>
            <div className="mt-1 text-sm text-slate-600">الرصيد المتاح بعد الشحن: {money(w.available + jodToFils(value))}</div>
          </div>
          <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            <Info className="mt-0.5 size-4 shrink-0" /> هذه عملية رصيد تجريبية داخل النموذج الأولي فقط، ولا تمثل تحويلاً مالياً حقيقياً.
          </p>
        </div>
      )}
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Internal rating
// ---------------------------------------------------------------------------

export function RateDialog({ captain, onClose }: { captain: Captain | null; onClose: () => void }) {
  const rateCaptain = useStore((s) => s.rateCaptain)
  const [stars, setStars] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const { run, isPending } = useAction()
  if (!captain) return null
  const save = () => {
    if (!stars) return setError('اختر عدد النجوم.')
    run('rate', () => {
      const r = rateCaptain(captain.id, stars, note)
      if (!r.ok) return setError(r.error!)
      toast.success('تم حفظ التقييم الداخلي')
      onClose()
    })
  }
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="تقييم الكابتن"
      description={`${captain.name} · تقييم داخلي للإدارة فقط`}
      footer={<><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={isPending('rate')}>حفظ التقييم</Button></>}
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <StarRating value={stars} onChange={(v) => { setStars(v); setError('') }} size="lg" />
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <Field label="ملاحظات داخلية (اختياري)">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="لا تظهر للكابتن أو التاجر" />}</Field>
        {captain.ratings.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">التقييمات السابقة</p>
            <ul className="max-h-36 space-y-2 overflow-y-auto">
              {[...captain.ratings].reverse().map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div><StarRating value={r.stars} size="sm" />{r.note && <p className="mt-1 text-slate-600">{r.note}</p>}</div>
                  <span className="text-slate-400">{dateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Captain eligibility picker (private dispatch)
// ---------------------------------------------------------------------------

function CaptainPicker({ order, value, onChange }: { order: Pick<Order, 'id' | 'fee' | 'pickupLat' | 'pickupLng'> & Partial<Order>; value: string; onChange: (id: string) => void }) {
  const { captains, orders, txs } = useStore()
  const rows = useMemo(() => {
    return captains
      .map((c) => ({
        c,
        blockers: orderBlockers(c, order as Order, orders, txs),
        km: distanceKm(c.lat, c.lng, order.pickupLat, order.pickupLng),
        rejected: order.rejectedBy?.includes(c.id),
      }))
      .sort((a, b) => a.blockers.length - b.blockers.length || a.km - b.km)
  }, [captains, orders, txs, order])
  return (
    <div className="max-h-72 space-y-2 overflow-y-auto pe-1">
      {rows.map(({ c, blockers, km, rejected }) => {
        const eligible = blockers.length === 0
        return (
          <button
            key={c.id}
            type="button"
            disabled={!eligible}
            onClick={() => onChange(c.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border p-3 text-start transition',
              eligible ? 'cursor-pointer hover:border-brand-500' : 'cursor-not-allowed opacity-60',
              value === c.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200',
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{c.code}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                {c.name}
                {rejected && <Badge tone="amber">رفض سابقاً</Badge>}
              </div>
              <div className="text-xs text-slate-500">
                الرصيد المتاح {money(walletOf(txs, c.id).available)} · يبعد ~{km.toFixed(1)} كم <span className="text-slate-400">(مسافة مباشرة)</span>
              </div>
              {!eligible && <div className="mt-0.5 text-xs text-rose-600">{blockers.join(' · ')}</div>}
            </div>
            {eligible ? <Badge tone="green">مؤهل</Badge> : <Badge tone="slate">غير مؤهل</Badge>}
          </button>
        )
      })}
    </div>
  )
}

export function AssignDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { offerPrivately, settings } = useStore()
  const [captainId, setCaptainId] = useState('')
  const [error, setError] = useState('')
  const { run, isPending } = useAction()
  if (!order) return null
  const submit = () => {
    if (!captainId) return setError('اختر كابتناً مؤهلاً.')
    run('assign', () => {
      const r = offerPrivately(order.id, captainId)
      if (!r.ok) return setError(r.error!)
      toast.success('تم إرسال عرض حصري للكابتن', { description: `ينتهي العرض خلال ${settings.privateOfferTtlMin} دقائق إن لم يتم الرد.` })
      onClose()
    })
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="توجيه خاص لكابتن"
      description={`${order.ref} · رسوم ${money(order.fee)}`}
      footer={<><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={submit} loading={isPending('assign')}><Send className="size-4" /> إرسال العرض الحصري</Button></>}
    >
      <div className="space-y-3">
        <p className="flex gap-2 rounded-lg bg-violet-50 p-3 text-xs leading-relaxed text-violet-800">
          <Lock className="mt-0.5 size-4 shrink-0" /> لن يظهر الطلب في القائمة العامة. يرى العرضَ الكابتنُ المختار فقط، ويمكنه القبول أو الرفض. عند الرفض أو انتهاء المهلة يعود الطلب إلى قائمة الإدارة.
        </p>
        <CaptainPicker order={order} value={captainId} onChange={(id) => { setCaptainId(id); setError('') }} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Manual order creation (admin dispatch)
// ---------------------------------------------------------------------------

export function CreateOrderDialog({ open, onClose, defaultMode = 'private' }: { open: boolean; onClose: () => void; defaultMode?: DispatchChoice['mode'] }) {
  const { merchants, createOrder, settings } = useStore()
  const active = merchants.filter((m) => m.status === 'active')
  const [f, setF] = useState(() => ({
    merchantId: active[0]?.id ?? '',
    customerName: '',
    customerPhone: '',
    area: AMMAN_AREAS[4],
    street: '',
    lat: AREA_COORDS[AMMAN_AREAS[4]][0],
    lng: AREA_COORDS[AMMAN_AREAS[4]][1],
    fee: '2',
    instructions: '',
  }))
  const [mode, setMode] = useState<DispatchChoice['mode']>(defaultMode === 'public' && !settings.publicBroadcasting ? 'queue' : defaultMode)
  const [captainId, setCaptainId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { run, isPending } = useAction()
  const m = merchants.find((x) => x.id === f.merchantId)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const fee = jodToFils(Number(f.fee) || 0)

  const submit = () => {
    const er: Record<string, string> = {}
    if (!m) er.merchantId = 'اختر التاجر.'
    if (!PHONE_RE.test(f.customerPhone)) er.customerPhone = 'رقم أردني من 10 خانات.'
    if (f.street.trim().length < 3) er.street = 'أدخل عنوان التوصيل.'
    if (!(Number(f.fee) > 0)) er.fee = 'رسوم أكبر من صفر.'
    if (mode === 'private' && !captainId) er.captain = 'اختر كابتناً مؤهلاً.'
    setErrors(er)
    if (Object.keys(er).length) return
    run('create', () => {
      const dispatch: DispatchChoice = mode === 'private' ? { mode, captainId } : { mode }
      const r = createOrder(
        { merchantId: f.merchantId, customerName: f.customerName.trim(), customerPhone: f.customerPhone, dropoffArea: f.area, dropoffAddress: `${f.area}، ${f.street.trim()}`, dropoffLat: f.lat, dropoffLng: f.lng, locationNotes: '', fee, instructions: f.instructions.trim(), merchantRef: '' },
        'admin',
        dispatch,
      )
      if (!r.ok) return setErrors({ captain: r.error! })
      toast.success(`تم إنشاء الطلب ${r.ref}`, { description: mode === 'private' ? 'أُرسل كعرض حصري للكابتن المختار.' : mode === 'queue' ? 'بانتظار التوجيه في قائمة الإدارة.' : settings.publicBroadcasting ? 'نُشر للكباتن المؤهلين.' : 'البث متوقف – الطلب في قائمة الانتظار.' })
      onClose()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="إنشاء طلب وتوجيهه" description="إنشاء طلب يدوي نيابة عن تاجر"
      footer={<><Button variant="outline" onClick={onClose}>إلغاء</Button><Button onClick={submit} loading={isPending('create')}>إنشاء الطلب</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="التاجر" required error={errors.merchantId}>{(id) => <Select id={id} value={f.merchantId} onChange={(e) => set('merchantId', e.target.value)}>{active.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
          <Field label="رسوم التوصيل (د.أ)" required error={errors.fee}>{(id) => <Input id={id} dir="ltr" type="number" step={0.5} min={0.5} value={f.fee} onChange={(e) => set('fee', e.target.value)} />}</Field>
          <Field label="هاتف العميل" required error={errors.customerPhone}>{(id) => <Input id={id} dir="ltr" inputMode="tel" value={f.customerPhone} onChange={(e) => set('customerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="07XXXXXXXX" />}</Field>
          <Field label="اسم العميل">{(id) => <Input id={id} value={f.customerName} onChange={(e) => set('customerName', e.target.value)} />}</Field>
          <Field label="منطقة التوصيل" required>{(id) => <Select id={id} value={f.area} onChange={(e) => { const a = e.target.value; setF((p) => ({ ...p, area: a, lat: AREA_COORDS[a][0], lng: AREA_COORDS[a][1] })) }}>{AMMAN_AREAS.map((a) => <option key={a}>{a}</option>)}</Select>}</Field>
          <Field label="العنوان" required error={errors.street}>{(id) => <Input id={id} value={f.street} onChange={(e) => set('street', e.target.value)} placeholder="الشارع، البناية" />}</Field>
        </div>
        <Field label="ملاحظات للكابتن">{(id) => <Input id={id} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} />}</Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">طريقة التوجيه</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              { v: 'private', t: 'توجيه خاص', d: 'عرض حصري لكابتن واحد', icon: Lock, disabled: false },
              { v: 'queue', t: 'قائمة الانتظار', d: 'يبقى بانتظار قرار الإدارة', icon: Clock, disabled: false },
              { v: 'public', t: 'نشر عام', d: settings.publicBroadcasting ? 'لجميع الكباتن المؤهلين' : 'البث العام متوقف حالياً', icon: Radio, disabled: !settings.publicBroadcasting },
            ] as const).map((o) => (
              <button key={o.v} type="button" disabled={o.disabled} onClick={() => setMode(o.v)}
                className={cn('rounded-xl border p-3 text-start transition disabled:cursor-not-allowed disabled:opacity-50', mode === o.v ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300 cursor-pointer')}>
                <o.icon className="mb-1 size-4 text-navy-700" />
                <div className="text-sm font-medium text-slate-800">{o.t}</div>
                <div className="text-xs text-slate-500">{o.d}</div>
              </button>
            ))}
          </div>
        </div>
        {mode === 'private' && m && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">اختر الكابتن <span className="text-xs font-normal text-slate-500">(يتم فحص الأهلية مقابل رسوم {money(fee)})</span></p>
            <CaptainPicker order={{ id: '__new__', fee, pickupLat: m.lat, pickupLng: m.lng }} value={captainId} onChange={setCaptainId} />
            {errors.captain && <p className="mt-2 text-sm text-rose-600">{errors.captain}</p>}
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Order detail drawer
// ---------------------------------------------------------------------------

export function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { orders, merchants, captains, settings, broadcastOrder, cancelOrder, expirePrivateOffer } = useStore()
  const now = useNow()
  const [assignOpen, setAssignOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { run, isPending, pending } = useAction()
  const order = orders.find((o) => o.id === orderId) ?? null
  if (!order) return null
  const m = merchants.find((x) => x.id === order.merchantId)
  const c = captains.find((x) => x.id === order.captainId)
  const pc = captains.find((x) => x.id === order.privateCaptainId)

  const markers: MapMarker[] = [
    { id: 'p', lat: order.pickupLat, lng: order.pickupLng, kind: 'pickup' },
    { id: 'd', lat: order.dropoffLat, lng: order.dropoffLng, kind: 'dropoff' },
  ]
  if (c && isActiveDelivery(order)) markers.push({ id: 'c', lat: c.lat, lng: c.lng, kind: 'busy', label: c.code })

  const doCancel = () =>
    run('cancel', () => {
      const r = cancelOrder(order.id, 'admin', reason.trim() || 'ألغي من قبل الإدارة')
      if (!r.ok) return void toast.error(r.error)
      toast.success(`تم إلغاء ${order.ref}`, { description: c ? 'تم تحرير المبلغ المحجوز من محفظة الكابتن.' : undefined })
      setCancelOpen(false)
    })

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={<span className="flex items-center gap-2">{order.ref} <OrderStatusBadge status={order.status} /></span>}
        subtitle={`أُنشئ ${dateTime(order.createdAt)} · ${relative(order.createdAt, now)}`}
        footer={
          <>
            {canTransition(order.status, 'offered_privately') && (
              <Button onClick={() => setAssignOpen(true)} disabled={!!pending}><UserCheck className="size-4" /> توجيه لكابتن</Button>
            )}
            {canTransition(order.status, 'awaiting_captain') && order.status !== 'awaiting_captain' && (
              <Button variant="outline" disabled={!settings.publicBroadcasting || !!pending} loading={isPending('broadcast')} title={settings.publicBroadcasting ? '' : 'البث العام متوقف'}
                onClick={() => run('broadcast', () => { const r = broadcastOrder(order.id); r.ok ? toast.success('تم نشر الطلب للكباتن المؤهلين') : toast.error(r.error) })}>
                <Radio className="size-4" /> نشر عام
              </Button>
            )}
            {canTransition(order.status, 'cancelled') && (
              <Button variant="ghost" className="ms-auto text-rose-600 hover:bg-rose-50" onClick={() => setCancelOpen(true)} disabled={!!pending}><Ban className="size-4" /> إلغاء الطلب</Button>
            )}
          </>
        }
      >
        <div className="space-y-5">
          {order.status === 'offered_privately' && pc && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Lock className="size-4" /> عرض حصري للكابتن <b>{pc.name}</b></span>
                {order.privateOfferExpiresAt && <Badge tone="violet"><Clock className="size-3" /> {relative(order.privateOfferExpiresAt, now)}</Badge>}
              </div>
              <button className="mt-2 text-xs text-violet-700 underline" onClick={() => { const r = expirePrivateOffer(order.id); r.ok ? toast.info('انتهت مهلة العرض (محاكاة)') : toast.error(r.error) }}>
                محاكاة انتهاء المهلة الآن (للعرض فقط)
              </button>
            </div>
          )}
          {order.status === 'pending_dispatch' && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {order.pausedByBroadcast ? 'الطلب في قائمة الانتظار لأن البث العام متوقف. وجّهه لكابتن محدد أو أعد تفعيل البث.' : 'الطلب بانتظار توجيه الإدارة.'}
              {order.rejectedBy.length > 0 && ` رفضه: ${order.rejectedBy.map((id) => captains.find((x) => x.id === id)?.name).join('، ')}.`}
            </div>
          )}
          {order.status === 'dispatch_expired' && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><Clock className="mt-0.5 size-4 shrink-0" /> انتهت مهلة العرض الخاص دون رد. أعد توجيه الطلب.</div>
          )}

          <MapView className="h-48" markers={markers} fit routes={[{ points: [[order.pickupLat, order.pickupLng], [order.dropoffLat, order.dropoffLng]], dashed: true }]} />
          <p className="-mt-3 text-[11px] text-slate-400">الخط المتقطع يربط نقطتي الاستلام والتسليم مباشرة ولا يمثل مساراً فعلياً.</p>

          <section>
            <h4 className="mb-1 text-xs font-semibold text-slate-400">الاستلام</h4>
            <KeyVal label="التاجر">{m?.name}</KeyVal>
            <KeyVal label="العنوان">{order.pickupAddress}</KeyVal>
          </section>
          <section className="border-t border-slate-100 pt-3">
            <h4 className="mb-1 text-xs font-semibold text-slate-400">التسليم</h4>
            <KeyVal label="العميل">{order.customerName || '—'}</KeyVal>
            <KeyVal label="الهاتف"><span dir="ltr">{order.customerPhone}</span></KeyVal>
            <KeyVal label="العنوان">{order.dropoffAddress}</KeyVal>
            {order.locationNotes && <KeyVal label="ملاحظات الموقع">{order.locationNotes}</KeyVal>}
            {order.instructions && <KeyVal label="تعليمات">{order.instructions}</KeyVal>}
            {order.merchantRef && <KeyVal label="مرجع التاجر">{order.merchantRef}</KeyVal>}
            <KeyVal label="رسوم التوصيل">{money(order.fee)}</KeyVal>
          </section>
          {c && (
            <section className="border-t border-slate-100 pt-3">
              <h4 className="mb-2 text-xs font-semibold text-slate-400">الكابتن</h4>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">{c.code}</span>
                <div className="flex-1 text-sm">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500" dir="ltr">{c.phone}</div>
                </div>
                {isActiveDelivery(order) && <GpsIndicator captain={c} now={now} compact />}
              </div>
            </section>
          )}
          <section className="border-t border-slate-100 pt-3">
            <h4 className="mb-3 text-xs font-semibold text-slate-400">سجل الحالات</h4>
            <EventLog order={order} />
          </section>
        </div>
      </Drawer>
      {assignOpen && <AssignDialog order={order} onClose={() => setAssignOpen(false)} />}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={doCancel}
        loading={isPending('cancel')}
        tone="danger"
        title={`إلغاء الطلب ${order.ref}؟`}
        description={c ? `سيتم تحرير ${money(order.fee)} المحجوزة في محفظة ${c.name}.` : 'لا يمكن التراجع عن الإلغاء.'}
        confirmLabel="إلغاء الطلب"
      >
        <Field label="سبب الإلغاء (اختياري)">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </ConfirmDialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Captain + merchant detail drawers
// ---------------------------------------------------------------------------

export function CaptainDrawer({ captainId, onClose, onOpenOrder, onShowOnMap }: { captainId: string | null; onClose: () => void; onOpenOrder: (id: string) => void; onShowOnMap: (id: string) => void }) {
  const { captains, orders, txs, merchants } = useStore()
  const now = useNow()
  const c = captains.find((x) => x.id === captainId)
  if (!c) return null
  const w = walletOf(txs, c.id)
  const history = orders.filter((o) => o.captainId === c.id).sort((a, b) => b.createdAt - a.createdAt)
  const delivered = history.filter((o) => o.status === 'delivered').length
  return (
    <Drawer open onClose={onClose} title={<span className="flex items-center gap-2">{c.name} <PresenceBadge presence={captainPresence(c, orders)} /></span>} subtitle={`كابتن ${c.code} · ${VEHICLE_LABEL[c.vehicleType]} · ${c.vehicleId}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['المتاح', money(w.available)], ['المحجوز', money(w.reserved)], ['توصيلات مكتملة', delivered]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{l}</div><div className="mt-1 font-semibold text-navy-900">{v}</div></div>
          ))}
        </div>
        <section>
          <KeyVal label="الهاتف"><span dir="ltr">{c.phone}</span></KeyVal>
          <KeyVal label="حالة الحساب">{c.status === 'active' ? <Badge tone="green">نشط</Badge> : <Badge tone="red">موقوف</Badge>}</KeyVal>
          <KeyVal label="التقييم الداخلي"><span className="flex items-center gap-2"><StarRating value={avgRating(c)} size="sm" /> {avgRating(c).toFixed(1)} ({c.ratings.length})</span></KeyVal>
          <KeyVal label="الموقع"><GpsIndicator captain={c} now={now} /></KeyVal>
          <KeyVal label="آخر تحديث للموقع">{relative(c.locationUpdatedAt, now)}</KeyVal>
          <KeyVal label="اسم المستخدم"><span dir="ltr" className="font-mono text-xs">{c.username}</span></KeyVal>
        </section>
        <Button variant="outline" size="sm" onClick={() => onShowOnMap(c.id)}><MapPin className="size-4" /> عرض على الخريطة</Button>
        <section>
          <h4 className="mb-2 text-xs font-semibold text-slate-400">سجل التوصيل</h4>
          {history.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">لا توجد طلبات لهذا الكابتن بعد.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {history.map((o) => (
                <li key={o.id}>
                  <button className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start hover:bg-slate-50" onClick={() => onOpenOrder(o.id)}>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium">{o.ref} · {merchants.find((m) => m.id === o.merchantId)?.name}</div>
                      <div className="text-xs text-slate-500">{dateTime(o.createdAt)} · {money(o.fee)}</div>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {c.ratings.some((r) => r.note) && (
          <section>
            <h4 className="mb-2 text-xs font-semibold text-slate-400">ملاحظات الإدارة</h4>
            <ul className="space-y-2">{c.ratings.filter((r) => r.note).map((r) => <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><StarRating value={r.stars} size="sm" /> {r.note}</li>)}</ul>
          </section>
        )}
      </div>
    </Drawer>
  )
}

export function MerchantDrawer({ merchantId, onClose, onOpenOrder }: { merchantId: string | null; onClose: () => void; onOpenOrder: (id: string) => void }) {
  const { merchants, orders } = useStore()
  const m = merchants.find((x) => x.id === merchantId)
  if (!m) return null
  const list = orders.filter((o) => o.merchantId === m.id).sort((a, b) => b.createdAt - a.createdAt)
  const delivered = list.filter((o) => o.status === 'delivered')
  return (
    <Drawer open onClose={onClose} title={m.name} subtitle={`${m.category} · ${m.area}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['إجمالي الطلبات', list.length], ['مكتملة', delivered.length], ['رسوم مكتملة', money(delivered.reduce((s, o) => s + o.fee, 0))]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{l}</div><div className="mt-1 font-semibold text-navy-900">{v}</div></div>
          ))}
        </div>
        <section>
          <KeyVal label="المسؤول">{m.ownerName}</KeyVal>
          <KeyVal label="الهاتف"><span dir="ltr" className="inline-flex items-center gap-1"><Phone className="size-3" />{m.phone}</span></KeyVal>
          <KeyVal label="العنوان">{m.address}</KeyVal>
          <KeyVal label="الإحداثيات"><span dir="ltr" className="font-mono text-xs">{m.lat.toFixed(4)}, {m.lng.toFixed(4)}</span></KeyVal>
          <KeyVal label="الحالة">{m.status === 'active' ? <Badge tone="green">نشط</Badge> : <Badge tone="red">موقوف</Badge>}</KeyVal>
          <KeyVal label="تاريخ الإنشاء">{dateTime(m.createdAt)}</KeyVal>
          <KeyVal label="بيانات الدخول"><span dir="ltr" className="font-mono text-xs">{m.username} / {m.password}</span></KeyVal>
        </section>
        <MapView className="h-40" zoom={14} center={[m.lat, m.lng]} markers={[{ id: m.id, lat: m.lat, lng: m.lng, kind: 'merchant' }]} />
        <section id="merchant-orders">
          <h4 className="mb-2 text-xs font-semibold text-slate-400">طلبات التاجر</h4>
          {list.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">لا توجد طلبات بعد.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {list.map((o) => (
                <li key={o.id}>
                  <button className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start hover:bg-slate-50" onClick={() => onOpenOrder(o.id)}>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium">{o.ref} · {o.dropoffArea}</div>
                      <div className="text-xs text-slate-500">{timeOnly(o.createdAt)} · {dateTime(o.createdAt)}</div>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  )
}

