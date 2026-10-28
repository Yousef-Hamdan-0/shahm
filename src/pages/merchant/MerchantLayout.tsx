import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AlertTriangle, LogOut } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Logo } from '../../components/shared'
import { cn } from '../../lib/cn'

export function useMerchant() {
  const id = useStore((s) => s.session?.merchantId)
  return useStore((s) => s.merchants.find((m) => m.id === id))
}

export default function MerchantLayout() {
  const merchant = useMerchant()
  const logout = useStore((s) => s.logout)
  const navigate = useNavigate()
  if (!merchant) return null
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-slate-100 text-navy-900' : 'text-slate-500 hover:text-navy-900')

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-[500] border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Logo compact />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-semibold text-navy-900">{merchant.name}</div>
            <div className="text-xs text-slate-400">بوابة التاجر</div>
          </div>
          <nav className="ms-auto flex items-center gap-1">
            <NavLink to="/merchant" end className={link}>الرئيسية</NavLink>
            <NavLink to="/merchant/orders" className={link}>طلباتي</NavLink>
          </nav>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>
      {merchant.status !== 'active' && (
        <div className="mx-auto mt-4 flex max-w-5xl items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="size-4" /> حسابك موقوف حالياً من قبل الإدارة. لا يمكنك إنشاء طلبات جديدة.
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-6 pb-28">
        <Outlet />
      </main>
    </div>
  )
}
