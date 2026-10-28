import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bike, LayoutDashboard, LogOut, Map, Menu, Package, Radio, Settings, Store, Wallet, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Logo } from '../../components/shared'
import { Badge, Button } from '../../components/ui'
import { cn } from '../../lib/cn'
import { DISPATCH_QUEUE } from '../../lib/rules'

const NAV = [
  { to: '/admin', label: 'نظرة عامة', icon: LayoutDashboard, end: true },
  { to: '/admin/merchants', label: 'التجار', icon: Store },
  { to: '/admin/captains', label: 'الكباتن', icon: Bike },
  { to: '/admin/orders', label: 'طلبات التوصيل', icon: Package, badge: 'queue' as const },
  { to: '/admin/map', label: 'الخريطة الحية', icon: Map },
  { to: '/admin/wallets', label: 'محافظ الكباتن', icon: Wallet },
  { to: '/admin/settings', label: 'الإعدادات', icon: Settings },
]

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useStore((s) => s.logout)
  const broadcasting = useStore((s) => s.settings.publicBroadcasting)
  const queue = useStore((s) => s.orders.filter((o) => DISPATCH_QUEUE.includes(o.status)).length)
  const title = [...NAV].reverse().find((n) => location.pathname.startsWith(n.to))?.label ?? ''

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo light />
        <button className="lg:hidden text-white/60" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                isActive ? 'bg-white/10 font-medium text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <n.icon className="size-[18px]" />
            <span className="flex-1">{n.label}</span>
            {n.badge === 'queue' && queue > 0 && <span className="rounded-full bg-amber-400 px-2 text-[11px] font-semibold text-navy-900">{queue}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold">إ</div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium">مدير العمليات</div>
            <div className="text-xs text-white/50">حساب تجريبي</div>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-[800] lg:hidden">
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-64">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[500] flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold text-navy-900">{title}</h1>
          <div className="ms-auto flex items-center gap-2">
            <NavLink to="/admin/settings">
              {broadcasting ? (
                <Badge tone="green">
                  <Radio className="size-3" /> البث العام مفعّل
                </Badge>
              ) : (
                <Badge tone="amber">
                  <Radio className="size-3" /> البث العام متوقف
                </Badge>
              )}
            </NavLink>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
