import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bike, LayoutDashboard, ShieldCheck, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../store/useStore'
import { Logo } from '../components/shared'
import { Button, Field, Input, Select, useAction } from '../components/ui'
import { money } from '../lib/format'
import { walletOf } from '../lib/rules'
import type { Role } from '../lib/types'

export default function Login() {
  const navigate = useNavigate()
  const { merchants, captains, txs, demoCaptainId, login, loginWithCredentials } = useStore()
  const [merchantId, setMerchantId] = useState(merchants.find((m) => m.status === 'active')?.id ?? '')
  const [captainId, setCaptainId] = useState(demoCaptainId)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { run, isPending, pending } = useAction()

  const quick = (role: Role) =>
    run(role, () => {
      login(role, role === 'merchant' ? merchantId : role === 'captain' ? captainId : undefined)
      navigate(`/${role}`)
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) return setError('أدخل اسم المستخدم وكلمة المرور.')
    run('form', () => {
      const r = loginWithCredentials(username, password)
      if (!r.ok) return setError(r.error!)
      toast.success('تم تسجيل الدخول')
      navigate(`/${r.session!.role}`)
    })
  }

  const cards = [
    {
      role: 'admin' as const,
      icon: LayoutDashboard,
      title: 'حساب الإدارة',
      desc: 'إدارة التجار والكباتن والطلبات والمحافظ',
      extra: null,
    },
    {
      role: 'merchant' as const,
      icon: Store,
      title: 'حساب التاجر',
      desc: 'طلب كابتن ومتابعة التوصيل',
      extra: (
        <Select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className="h-9 text-xs" aria-label="اختر التاجر">
          {merchants.filter((m) => m.status === 'active').map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
      ),
    },
    {
      role: 'captain' as const,
      icon: Bike,
      title: 'حساب الكابتن',
      desc: 'استقبال الطلبات وتنفيذ التوصيل',
      extra: (
        <Select value={captainId} onChange={(e) => setCaptainId(e.target.value)} className="h-9 text-xs" aria-label="اختر الكابتن">
          {captains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name} · {money(walletOf(txs, c.id).available)}
              {c.status !== 'active' ? ' (موقوف)' : ''}
            </option>
          ))}
        </Select>
      ),
    },
  ]

  return (
    <div className="grid min-h-full lg:grid-cols-[1fr_1.1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex">
        <Logo light />
        <div className="max-w-md">
          <h1 className="text-4xl leading-tight font-bold">منصة تشغيل التوصيل للأعمال</h1>
          <p className="mt-4 text-white/70 leading-relaxed">
            شهم تربط المطاعم والمقاهي والمتاجر بكباتن التوصيل، مع تحكم كامل للإدارة في التوزيع والمحافظ والتتبع.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {['توزيع ذكي حسب أهلية الكابتن ورصيد المحفظة', 'توجيه خاص للطلبات وإيقاف البث العام عند الحاجة', 'متابعة لحظية لمراحل التوصيل للتاجر والإدارة'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">نموذج أولي تفاعلي للعرض · جميع البيانات وهمية · عمّان، الأردن</p>
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full border-[40px] border-white/[0.03]" />
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-lg">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold text-navy-900">تسجيل الدخول</h2>
          <p className="mt-1 text-sm text-slate-500">اختر أحد حسابات العرض للدخول مباشرة دون تسجيل.</p>

          <div className="mt-6 space-y-3">
            {cards.map((c) => (
              <div key={c.role} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <c.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-900">{c.title}</div>
                    <div className="text-xs text-slate-500">{c.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:w-64">
                  {c.extra && <div className="flex-1">{c.extra}</div>}
                  <Button onClick={() => quick(c.role)} loading={isPending(c.role)} disabled={!!pending} className={c.extra ? '' : 'w-full'}>
                    دخول <ArrowLeft className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="my-8 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> أو باستخدام بيانات حساب تم إنشاؤه <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم المستخدم">{(id) => <Input id={id} dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />}</Field>
              <Field label="كلمة المرور">{(id) => <Input id={id} dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}</Field>
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <Button type="submit" variant="outline" className="w-full" loading={isPending('form')}>
              دخول
            </Button>
            <p className="text-center text-xs text-slate-400" dir="ltr">admin / admin1234 · merchant1 / demo1234 · captaina / demo1234</p>
          </form>
        </div>
      </section>
    </div>
  )
}
