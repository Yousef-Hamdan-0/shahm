import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Inbox, Lock, MapPin, MapPinOff, Navigation, Store, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { Badge, Button, Card, ConfirmDialog, EmptyState, useAction } from '../../components/ui'
import { money, num, relative } from '../../lib/format'
import { WALLET_EMPTY_MSG, activeOrderOf, availabilityBlockers, distanceKm, feedFor, gpsHealthy, orderBlockers, walletOf } from '../../lib/rules'
import type { Order } from '../../lib/types'
import { useNow } from '../../lib/useNow'
import { useCaptain } from './CaptainLayout'

export default function Available() {
  const captain = useCaptain()!
  const { orders, txs, merchants, acceptOrder, dismissOffer, setAvailability } = useStore()
  const navigate = useNavigate()
  const now = useNow(1000)
  const { run, isPending, pending } = useAction()
  const [reject, setReject] = useState<Order | null>(null)

  const wallet = walletOf(txs, captain.id)
  const active = activeOrderOf(orders, captain.id)
  const feed = feedFor(captain, orders, txs)
  // Public orders hidden only because this captain's balance is below the fee
  const overBudget = orders.filter((o) => o.status === 'awaiting_captain' && !o.dismissedBy.includes(captain.id)).filter((o) => {
    const b = orderBlockers(captain, o, orders, txs)
    return b.length === 1 && b[0] === 'رصيد المحفظة أقل من رسوم الطلب'
  }).length

  const accept = (o: Order) =>
    run(`a${o.id}`, () => {
      const r = acceptOrder(o.id, captain.id)
      if (!r.ok) return void toast.error(r.error)
      toast.success(`تم قبول الطلب ${o.ref}`, { description: `تم حجز ${money(o.fee)} من رصيدك.` })
      navigate('/captain/active')
    })

  const dismiss = (o: Order) =>
    run(`d${o.id}`, () => {
      const r = dismissOffer(o.id, captain.id)
      if (!r.ok) return void toast.error(r.error)
      toast(o.status === 'offered_privately' ? 'تم رفض العرض وإعادته للإدارة' : 'تم إخفاء الطلب من قائمتك')
      setReject(null)
    }, 300)

  // ---- blocking states ----
  if (active)
    return (
      <Card className="p-6 text-center">
        <Navigation className="mx-auto size-8 text-brand-500" />
        <p className="mt-3 font-semibold text-navy-900">لديك توصيلة نشطة</p>
        <p className="mt-1 text-sm text-slate-500">أكمل الطلب {active.ref} لاستقبال طلبات جديدة.</p>
        <Button size="lg" className="mt-4 w-full" onClick={() => navigate('/captain/active')}>متابعة التوصيل <ArrowLeft className="size-4" /></Button>
      </Card>
    )

  const banners = (
    <>
      {captain.status !== 'active' && <Banner tone="red" icon={Lock} text="حسابك موقوف من قبل الإدارة. لا يمكنك استقبال الطلبات." />}
      {wallet.available <= 0 && <Banner tone="red" icon={Wallet} text={WALLET_EMPTY_MSG} />}
      {!gpsHealthy(captain) && <Banner tone="amber" icon={MapPinOff} text="خدمة الموقع غير متاحة. لن تظهر لك الطلبات حتى تعود الإشارة." />}
    </>
  )

  if (!captain.available) {
    const blockers = availabilityBlockers(captain, orders, txs)
    return (
      <div className="space-y-3">
        {banners}
        <Card className="p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Inbox className="size-7" /></div>
          <p className="mt-3 font-semibold text-navy-900">أنت غير متاح حالياً</p>
          <p className="mt-1 text-sm text-slate-500">فعّل التوفر لرؤية الطلبات المؤهلة لك.</p>
          <Button
            size="xl"
            variant="brand"
            className="mt-5 w-full"
            disabled={blockers.length > 0}
            loading={isPending('avail')}
            onClick={() => run('avail', () => { const r = setAvailability(captain.id, true); r.ok ? toast.success('أنت الآن متاح لاستقبال الطلبات') : toast.error(r.error) })}
          >
            أصبح متاحاً
          </Button>
          {blockers.length > 0 && <p className="mt-2 text-xs text-slate-400">يجب استيفاء الشروط أعلاه أولاً.</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {banners}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-navy-900">الطلبات المتاحة <span className="text-slate-400">({num(feed.length)})</span></h2>
        <span className="text-xs text-slate-500">رصيدك المتاح: <b className="text-navy-900">{money(wallet.available)}</b></span>
      </div>

      {feed.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="لا توجد طلبات مؤهلة الآن"
            description={wallet.available <= 0 ? 'رصيد محفظتك صفر، لذلك لا تظهر لك أي طلبات.' : 'ستظهر الطلبات الجديدة هنا تلقائياً عند توفرها.'}
          />
        </Card>
      ) : (
        feed.map((o) => {
          const m = merchants.find((x) => x.id === o.merchantId)
          const isPrivate = o.status === 'offered_privately'
          const toPickup = distanceKm(captain.lat, captain.lng, o.pickupLat, o.pickupLng)
          const trip = distanceKm(o.pickupLat, o.pickupLng, o.dropoffLat, o.dropoffLng)
          return (
            <Card key={o.id} className={isPrivate ? 'border-violet-300 ring-2 ring-violet-200' : ''}>
              {isPrivate && (
                <div className="flex items-center justify-between rounded-t-2xl bg-violet-50 px-4 py-2 text-xs font-medium text-violet-800">
                  <span className="flex items-center gap-1.5"><Lock className="size-3.5" /> عرض حصري لك من الإدارة</span>
                  {o.privateOfferExpiresAt && <span className="flex items-center gap-1"><Clock className="size-3.5" /> ينتهي {relative(o.privateOfferExpiresAt, now)}</span>}
                </div>
              )}
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold text-navy-900"><Store className="size-4 text-slate-400" /> {m?.name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{o.ref} · {relative(o.createdAt, now)}</div>
                  </div>
                  <div className="text-end">
                    <div className="text-xl font-bold text-brand-600">{money(o.fee)}</div>
                    <div className="text-[10px] text-slate-400">رسوم التوصيل</div>
                  </div>
                </div>
                <div className="relative space-y-3 ps-5">
                  <span className="absolute top-2 bottom-2 start-[5px] w-0.5 bg-slate-200" />
                  <div className="relative">
                    <span className="absolute top-1 -start-5 size-3 rounded-full border-2 border-white bg-blue-600 ring-1 ring-blue-600" />
                    <div className="text-xs text-slate-400">الاستلام</div>
                    <div className="text-sm font-medium">{o.pickupArea}</div>
                  </div>
                  <div className="relative">
                    <span className="absolute top-1 -start-5 size-3 rounded-full border-2 border-white bg-rose-600 ring-1 ring-rose-600" />
                    <div className="text-xs text-slate-400">التسليم</div>
                    <div className="text-sm font-medium">{o.dropoffArea}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge><MapPin className="size-3" /> ~{toPickup.toFixed(1)} كم إلى المتجر</Badge>
                  <Badge><Navigation className="size-3" /> ~{trip.toFixed(1)} كم للتوصيل</Badge>
                </div>
                <p className="-mt-2 text-[10px] text-slate-400">مسافات مباشرة تقريبية وليست مسار طريق فعلي.</p>
                {o.instructions && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{o.instructions}</p>}
                <div className="flex gap-2">
                  <Button size="lg" variant="brand" className="flex-1" onClick={() => accept(o)} loading={isPending(`a${o.id}`)} disabled={!!pending}>قبول الطلب</Button>
                  <Button size="lg" variant="outline" onClick={() => (isPrivate ? setReject(o) : dismiss(o))} loading={isPending(`d${o.id}`)} disabled={!!pending} aria-label={isPrivate ? 'رفض' : 'تجاهل'}>
                    <X className="size-4" /> {isPrivate ? 'رفض' : 'تجاهل'}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })
      )}

      {overBudget > 0 && wallet.available > 0 && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
          يوجد {num(overBudget)} طلب برسوم أعلى من رصيدك المتاح ({money(wallet.available)}) ولا يظهر لك. تواصل مع الإدارة لشحن الرصيد.
        </p>
      )}

      <ConfirmDialog
        open={!!reject}
        onClose={() => setReject(null)}
        onConfirm={() => reject && dismiss(reject)}
        loading={!!reject && isPending(`d${reject.id}`)}
        title="رفض العرض الحصري؟"
        description="سيعود الطلب إلى الإدارة لتوجيهه لكابتن آخر."
        confirmLabel="رفض العرض"
        tone="danger"
      />
    </div>
  )
}

function Banner({ tone, icon: Icon, text }: { tone: 'red' | 'amber'; icon: typeof Wallet; text: string }) {
  return (
    <div className={tone === 'red' ? 'flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800' : 'flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  )
}
