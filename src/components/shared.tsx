import { Check, MapPin, MapPinOff, Navigation, Radio, Satellite } from 'lucide-react'
import { cn } from '../lib/cn'
import { MERCHANT_STATUS_LABEL, STATUS_LABEL, relative, timeOnly } from '../lib/format'
import { activeOrderOf, gpsHealthy, locationIsStale } from '../lib/rules'
import type { Actor, Captain, Order, OrderStatus, WalletTxType } from '../lib/types'
import { Badge, type Tone } from './ui'

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex size-9 items-center justify-center rounded-xl', light ? 'bg-white/10' : 'bg-navy-900')}>
        <svg viewBox="0 0 32 32" className="size-6">
          <path d="M9 20.5c2.2 1.6 4.5 2.3 7 2.3 4 0 6.5-2 6.5-4.8 0-5.6-12.6-3.6-12.6-9 0-2.4 2.3-4.2 5.8-4.2 2.2 0 4.1.6 5.8 1.7" fill="none" stroke="#10B981" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className={cn('text-lg font-bold', light ? 'text-white' : 'text-navy-900')}>شهم</div>
          <div className={cn('text-[10px] font-medium tracking-[0.2em]', light ? 'text-white/50' : 'text-slate-400')}>SHAHM</div>
        </div>
      )}
    </div>
  )
}

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending_dispatch: 'amber',
  awaiting_captain: 'slate',
  offered_privately: 'violet',
  accepted: 'blue',
  heading_to_pickup: 'blue',
  picked_up: 'blue',
  on_the_way: 'blue',
  delivered: 'green',
  cancelled: 'red',
  dispatch_expired: 'amber',
}

export function OrderStatusBadge({ status, audience = 'admin' }: { status: OrderStatus; audience?: 'admin' | 'merchant' }) {
  const label = audience === 'merchant' ? MERCHANT_STATUS_LABEL[status] : STATUS_LABEL[status]
  return (
    <Badge tone={audience === 'merchant' && ['pending_dispatch', 'offered_privately', 'dispatch_expired'].includes(status) ? 'slate' : STATUS_TONE[status]} dot>
      {label}
    </Badge>
  )
}

export type Presence = 'available' | 'busy' | 'offline' | 'inactive'

export function captainPresence(c: Captain, orders: Order[]): Presence {
  if (c.status !== 'active') return 'inactive'
  if (activeOrderOf(orders, c.id)) return 'busy'
  return c.available ? 'available' : 'offline'
}

export const PRESENCE: Record<Presence, { label: string; tone: Tone; color: string }> = {
  available: { label: 'متاح', tone: 'green', color: '#10B981' },
  busy: { label: 'في توصيلة', tone: 'amber', color: '#F59E0B' },
  offline: { label: 'غير متاح', tone: 'slate', color: '#94A3B8' },
  inactive: { label: 'موقوف', tone: 'red', color: '#E11D48' },
}

export function PresenceBadge({ presence }: { presence: Presence }) {
  return (
    <Badge tone={PRESENCE[presence].tone} dot>
      {PRESENCE[presence].label}
    </Badge>
  )
}

/** Honest location indicator: distinguishes real browser GPS from simulated coordinates. */
export function GpsIndicator({ captain, now = Date.now(), compact }: { captain: Captain; now?: number; compact?: boolean }) {
  if (captain.gpsMode === 'off')
    return (
      <Badge tone="slate">
        <MapPinOff className="size-3" /> الموقع غير مفعّل
      </Badge>
    )
  if (!gpsHealthy(captain))
    return (
      <Badge tone="red">
        <MapPinOff className="size-3" /> إشارة الموقع مفقودة
      </Badge>
    )
  const stale = locationIsStale(captain, now)
  if (stale)
    return (
      <Badge tone="amber">
        <MapPin className="size-3" /> موقع قديم · {relative(captain.locationUpdatedAt, now)}
      </Badge>
    )
  if (captain.gpsMode === 'browser')
    return (
      <Badge tone="green">
        <span className="pulse-ring relative inline-flex size-2 rounded-full bg-emerald-500 text-emerald-500" /> موقع مباشر من الجهاز
      </Badge>
    )
  return (
    <Badge tone="blue">
      <Satellite className="size-3" /> {compact ? 'موقع تجريبي' : 'موقع تجريبي (محاكاة)'}
    </Badge>
  )
}

export function SimulatedTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border border-dashed border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700', className)}>
      <Radio className="size-3" /> محاكاة للعرض
    </span>
  )
}

const MERCHANT_STEPS: { key: OrderStatus[]; label: string }[] = [
  { key: ['pending_dispatch', 'awaiting_captain', 'offered_privately', 'dispatch_expired'], label: 'تم استلام الطلب' },
  { key: ['accepted'], label: 'تم تعيين كابتن' },
  { key: ['heading_to_pickup'], label: 'الكابتن في الطريق إليك' },
  { key: ['picked_up'], label: 'تم الاستلام من المتجر' },
  { key: ['on_the_way'], label: 'في الطريق للعميل' },
  { key: ['delivered'], label: 'تم التوصيل' },
]

/** Linear progress stepper used by merchant and captain views. */
export function OrderProgress({ order, compact }: { order: Order; compact?: boolean }) {
  const current = MERCHANT_STEPS.findIndex((s) => s.key.includes(order.status))
  const cancelled = order.status === 'cancelled'
  const at = (statuses: OrderStatus[]) => {
    const hit = [...order.timeline].reverse().find((t) => statuses.includes(t.status))
    return hit ? timeOnly(hit.at) : null
  }
  return (
    <ol className={cn('relative', compact ? 'space-y-3' : 'space-y-4')}>
      {MERCHANT_STEPS.map((s, i) => {
        const done = !cancelled && (i < current || order.status === 'delivered')
        const active = !cancelled && i === current && order.status !== 'delivered'
        const time = i === 0 ? timeOnly(order.createdAt) : done || active ? at(s.key) : null
        return (
          <li key={s.label} className="relative flex items-start gap-3">
            {i < MERCHANT_STEPS.length - 1 && (
              <span className={cn('absolute top-6 start-[11px] h-[calc(100%-4px)] w-0.5', done ? 'bg-brand-500' : 'bg-slate-200')} />
            )}
            <span
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                done && 'border-brand-500 bg-brand-500 text-white',
                active && 'border-brand-500 bg-white',
                !done && !active && 'border-slate-200 bg-white',
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : active ? <span className="size-2 animate-pulse rounded-full bg-brand-500" /> : null}
            </span>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pt-0.5">
              <span className={cn('text-sm', done || active ? 'font-medium text-navy-900' : 'text-slate-400')}>{s.label}</span>
              {time && <span className="text-xs text-slate-400">{time}</span>}
            </div>
          </li>
        )
      })}
      {cancelled && (
        <li className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          تم إلغاء الطلب {order.timeline.at(-1)?.note ? `– ${order.timeline.at(-1)!.note}` : ''}
        </li>
      )}
    </ol>
  )
}

const ACTOR_LABEL: Record<Actor, string> = { admin: 'الإدارة', merchant: 'التاجر', captain: 'الكابتن', system: 'النظام' }

/** Full audit trail of state transitions (admin). */
export function EventLog({ order }: { order: Order }) {
  return (
    <ol className="space-y-3">
      {[...order.timeline].reverse().map((t, i) => (
        <li key={i} className="flex gap-3">
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', i === 0 ? 'bg-brand-500' : 'bg-slate-300')} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-800">{STATUS_LABEL[t.status]}</span>
              <span className="text-xs text-slate-400">{timeOnly(t.at)}</span>
            </div>
            <div className="text-xs text-slate-500">
              {ACTOR_LABEL[t.by]}
              {t.note ? ` · ${t.note}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DirectionsLink({ lat, lng, label = 'فتح الاتجاهات' }: { lat: number; lng: number; label?: string }) {
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
    >
      <Navigation className="size-4" /> {label}
    </a>
  )
}

/** Ledger entry presentation; reservations and debits reduce the available balance. */
export const TX_META: Record<WalletTxType, { label: string; tone: Tone; sign: string }> = {
  recharge: { label: 'شحن من الإدارة', tone: 'green', sign: '+' },
  reservation: { label: 'حجز رسوم طلب', tone: 'amber', sign: '−' },
  debit: { label: 'خصم توصيل مكتمل', tone: 'slate', sign: '−' },
  release: { label: 'تحرير حجز بعد إلغاء', tone: 'blue', sign: '+' },
}

