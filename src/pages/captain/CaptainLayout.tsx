import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { History, ListChecks, Navigation, User, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Switch } from '../../components/ui'
import { GpsIndicator } from '../../components/shared'
import { activeOrderOf, feedFor } from '../../lib/rules'
import { useNow } from '../../lib/useNow'
import { cn } from '../../lib/cn'

export function useCaptain() {
  const id = useStore((s) => s.session?.captainId)
  return useStore((s) => s.captains.find((c) => c.id === id))
}

/** Holds the last real geolocation error so pages can explain it and offer a retry. */
export const geoState = { error: '' as string, listeners: new Set<() => void>() }
export function setGeoError(msg: string) {
  geoState.error = msg
  geoState.listeners.forEach((l) => l())
}
export function useGeoError() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    geoState.listeners.add(l)
    return () => void geoState.listeners.delete(l)
  }, [])
  return geoState.error
}

/** One-shot request used by "retry" buttons; prompts for permission again where the browser allows it. */
export function requestBrowserLocation(captainId: string, onDone?: (ok: boolean) => void) {
  const { updateLocation, setGpsLost } = useStore.getState()
  if (!('geolocation' in navigator)) {
    setGeoError('المتصفح لا يدعم خدمة الموقع.')
    return onDone?.(false)
  }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      setGeoError('')
      updateLocation(captainId, p.coords.latitude, p.coords.longitude)
      setGpsLost(captainId, false)
      onDone?.(true)
    },
    (err) => {
      setGeoError(err.code === err.PERMISSION_DENIED ? 'تم رفض إذن الوصول للموقع. فعّل الإذن من إعدادات المتصفح ثم أعد المحاولة.' : 'تعذر تحديد موقعك حالياً. تأكد من تفعيل GPS ثم أعد المحاولة.')
      setGpsLost(captainId, true)
      onDone?.(false)
    },
    { enableHighAccuracy: true, timeout: 15000 },
  )
}

/** Starts real browser geolocation for the logged-in captain when they opted into it. */
function useBrowserGps(captainId: string | undefined, enabled: boolean) {
  const { updateLocation, setGpsLost } = useStore()
  const watch = useRef<number | null>(null)
  useEffect(() => {
    if (!captainId || !enabled) return
    if (!('geolocation' in navigator)) {
      setGeoError('المتصفح لا يدعم خدمة الموقع.')
      setGpsLost(captainId, true)
      return
    }
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setGeoError('')
        updateLocation(captainId, p.coords.latitude, p.coords.longitude)
        if (useStore.getState().captains.find((c) => c.id === captainId)?.gpsLost) setGpsLost(captainId, false)
      },
      (err) => {
        setGeoError(err.code === err.PERMISSION_DENIED ? 'تم رفض إذن الوصول للموقع. فعّل الإذن من إعدادات المتصفح ثم أعد المحاولة.' : 'تعذر تحديد موقعك حالياً. تأكد من تفعيل GPS ثم أعد المحاولة.')
        setGpsLost(captainId, true)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
    }
  }, [captainId, enabled, updateLocation, setGpsLost])
}

export default function CaptainLayout() {
  const captain = useCaptain()
  const { orders, txs, setAvailability } = useStore()
  const now = useNow(5000)
  useBrowserGps(captain?.id, captain?.gpsMode === 'browser')
  if (!captain) return null

  const feed = feedFor(captain, orders, txs).length
  const active = activeOrderOf(orders, captain.id)

  const toggle = (on: boolean) => {
    const r = setAvailability(captain.id, on)
    if (!r.ok) toast.error('لا يمكن تفعيل التوفر', { description: r.error })
    else toast.success(on ? 'أنت الآن متاح لاستقبال الطلبات' : 'تم إيقاف استقبال الطلبات')
  }

  const tabs = [
    { to: '/captain', label: 'الطلبات', icon: ListChecks, end: true, badge: feed },
    { to: '/captain/active', label: 'التوصيل', icon: Navigation, dot: !!active },
    { to: '/captain/history', label: 'السجل', icon: History },
    { to: '/captain/wallet', label: 'المحفظة', icon: Wallet },
    { to: '/captain/profile', label: 'حسابي', icon: User },
  ]

  return (
    <div className="min-h-full bg-slate-200/60">
      <div className="relative mx-auto flex min-h-screen max-w-[440px] flex-col bg-slate-50 shadow-xl shadow-navy-900/5">
        <header className="sticky top-0 z-[500] bg-navy-900 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-white/50">كابتن {captain.code}</div>
              <div className="truncate font-semibold">{captain.name}</div>
            </div>
            <GpsIndicator captain={captain} now={now} compact />
          </div>
          <div className={cn('mt-3 flex items-center justify-between rounded-2xl px-4 py-3', captain.available ? 'bg-brand-500/15' : 'bg-white/5')}>
            <div>
              <div className="font-medium">{captain.available ? 'متاح لاستقبال الطلبات' : 'غير متاح'}</div>
              <div className="text-xs text-white/50">{active ? `في توصيلة ${active.ref}` : captain.available ? 'ستظهر لك الطلبات المؤهلة تلقائياً' : 'فعّل التوفر لرؤية الطلبات'}</div>
            </div>
            <Switch size="lg" checked={captain.available} onChange={toggle} label="التوفر" />
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-28">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 z-[500] grid w-full max-w-[440px] grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-600' : 'text-slate-400')}>
              <span className="relative">
                <t.icon className="size-6" />
                {!!t.badge && <span className="absolute -top-1.5 -end-2 min-w-4 rounded-full bg-brand-500 px-1 text-center text-[10px] leading-4 text-white">{t.badge}</span>}
                {t.dot && <span className="absolute -top-0.5 -end-0.5 size-2.5 rounded-full border-2 border-white bg-amber-500" />}
              </span>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
