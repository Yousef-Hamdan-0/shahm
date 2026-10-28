import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bike, LogOut, MapPin, Phone, Satellite, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Button, Card, ConfirmDialog, KeyVal, StarRating } from '../../components/ui'
import { GpsIndicator, PRESENCE, captainPresence } from '../../components/shared'
import { VEHICLE_LABEL } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { cn } from '../../lib/cn'
import { requestBrowserLocation, useCaptain, useGeoError } from './CaptainLayout'

export default function Profile() {
  const captain = useCaptain()!
  const { orders, setGpsMode, logout } = useStore()
  const navigate = useNavigate()
  const now = useNow(5000)
  const geoError = useGeoError()
  const [askBrowser, setAskBrowser] = useState(false)
  const [busy, setBusy] = useState(false)
  const avg = captain.ratings.length ? captain.ratings.reduce((s, r) => s + r.stars, 0) / captain.ratings.length : 0
  const presence = captainPresence(captain, orders)

  const enableBrowser = () => {
    setBusy(true)
    requestBrowserLocation(captain.id, (ok) => {
      setBusy(false)
      setAskBrowser(false)
      if (ok) {
        setGpsMode(captain.id, 'browser')
        toast.success('تم تفعيل موقع الجهاز المباشر')
      } else toast.error('تعذر الوصول إلى موقع الجهاز', { description: 'تم الإبقاء على الوضع السابق.' })
    })
  }

  const modes = [
    { v: 'demo' as const, icon: Satellite, t: 'موقع تجريبي (محاكاة)', d: 'إحداثيات وهمية لأغراض العرض' },
    { v: 'browser' as const, icon: Smartphone, t: 'موقع الجهاز المباشر', d: 'يتطلب إذنك الصريح في المتصفح' },
    { v: 'off' as const, icon: MapPin, t: 'إيقاف الموقع', d: 'لن تتمكن من استقبال الطلبات' },
  ]

  return (
    <div className="space-y-3">
      <Card className="p-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-navy-900 text-xl font-bold text-white">{captain.code}</div>
        <div className="mt-3 text-lg font-bold text-navy-900">{captain.name}</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-500"><StarRating value={avg} size="sm" /> {avg ? avg.toFixed(1) : 'بدون تقييم'}</div>
        <p className="mt-1 text-[11px] text-slate-400">تقييم الإدارة الداخلي</p>
      </Card>

      <Card className="divide-y divide-slate-100 px-4">
        <KeyVal label="الهاتف"><span dir="ltr" className="inline-flex items-center gap-1"><Phone className="size-3" />{captain.phone}</span></KeyVal>
        <KeyVal label="المركبة"><span className="inline-flex items-center gap-1"><Bike className="size-3.5" />{VEHICLE_LABEL[captain.vehicleType]} · <span dir="ltr">{captain.vehicleId}</span></span></KeyVal>
        <KeyVal label="حالة التوفر"><span style={{ color: PRESENCE[presence].color }}>{PRESENCE[presence].label}</span></KeyVal>
        <KeyVal label="حالة الموقع"><GpsIndicator captain={captain} now={now} /></KeyVal>
      </Card>

      <Card className="space-y-2 p-4">
        <div className="text-sm font-semibold text-navy-900">مصدر الموقع</div>
        {modes.map((m) => (
          <button
            key={m.v}
            onClick={() => (m.v === 'browser' ? setAskBrowser(true) : (setGpsMode(captain.id, m.v), toast.success(m.v === 'off' ? 'تم إيقاف الموقع وتحويلك إلى غير متاح' : 'تم تفعيل الموقع التجريبي')))}
            className={cn('flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-start', captain.gpsMode === m.v ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}
          >
            <m.icon className="size-5 text-navy-700" />
            <div className="flex-1"><div className="text-sm font-medium">{m.t}</div><div className="text-xs text-slate-500">{m.d}</div></div>
            <span className={cn('size-4 rounded-full border-2', captain.gpsMode === m.v ? 'border-brand-500 bg-brand-500' : 'border-slate-300')} />
          </button>
        ))}
        {geoError && captain.gpsMode === 'browser' && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
            {geoError}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => requestBrowserLocation(captain.id)}>إعادة المحاولة</Button>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-slate-400">لا يمكن ضمان تتبع الموقع بشكل متواصل عند إغلاق المتصفح أو تشغيله في الخلفية أو قفل الهاتف.</p>
      </Card>

      <Button variant="outline" size="lg" className="w-full" onClick={() => { logout(); navigate('/login') }}><LogOut className="size-4" /> تسجيل الخروج</Button>

      <ConfirmDialog
        open={askBrowser}
        onClose={() => setAskBrowser(false)}
        onConfirm={enableBrowser}
        loading={busy}
        tone="brand"
        title="استخدام موقع جهازك؟"
        description="سيطلب المتصفح إذنك لمشاركة موقعك الحقيقي. يُستخدم الموقع داخل هذا العرض التجريبي فقط ويُحفظ في هذا المتصفح، ولا يوجد خادم يستقبله."
        confirmLabel="السماح ومتابعة"
      />
    </div>
  )
}
