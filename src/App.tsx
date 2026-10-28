import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useStore } from './store/useStore'
import type { Role } from './lib/types'
import { DemoPanel } from './components/DemoPanel'
import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import AdminOverview from './pages/admin/Overview'
import AdminMerchants from './pages/admin/Merchants'
import AdminCaptains from './pages/admin/Captains'
import AdminOrders from './pages/admin/Orders'
import AdminLiveMap from './pages/admin/LiveMap'
import AdminWallets from './pages/admin/Wallets'
import AdminSettings from './pages/admin/Settings'
import MerchantLayout from './pages/merchant/MerchantLayout'
import MerchantHome from './pages/merchant/Home'
import MerchantRequest from './pages/merchant/RequestCaptain'
import MerchantOrders from './pages/merchant/Orders'
import MerchantOrderDetail from './pages/merchant/OrderDetail'
import CaptainLayout from './pages/captain/CaptainLayout'
import CaptainAvailable from './pages/captain/Available'
import CaptainActive from './pages/captain/Active'
import CaptainHistory from './pages/captain/History'
import CaptainWallet from './pages/captain/Wallet'
import CaptainProfile from './pages/captain/Profile'

export const homeFor = (role: Role) => `/${role}`

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const session = useStore((s) => s.session)
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== role) return <Navigate to={homeFor(session.role)} replace />
  return <>{children}</>
}

function Root() {
  const session = useStore((s) => s.session)
  return <Navigate to={session ? homeFor(session.role) : '/login'} replace />
}

/** Drives offer expiry and simulated movement; also re-reads state written by other tabs. */
function Simulator() {
  const tick = useStore((s) => s.tick)
  useEffect(() => {
    const t = setInterval(() => tick(Date.now()), 4000)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'shahm-demo-v1') void useStore.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(t)
      window.removeEventListener('storage', onStorage)
    }
  }, [tick])
  return null
}

export default function App() {
  return (
    <>
      <Simulator />
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
          <Route index element={<AdminOverview />} />
          <Route path="merchants" element={<AdminMerchants />} />
          <Route path="captains" element={<AdminCaptains />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="map" element={<AdminLiveMap />} />
          <Route path="wallets" element={<AdminWallets />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="/merchant" element={<RequireRole role="merchant"><MerchantLayout /></RequireRole>}>
          <Route index element={<MerchantHome />} />
          <Route path="request" element={<MerchantRequest />} />
          <Route path="orders" element={<MerchantOrders />} />
          <Route path="orders/:id" element={<MerchantOrderDetail />} />
        </Route>
        <Route path="/captain" element={<RequireRole role="captain"><CaptainLayout /></RequireRole>}>
          <Route index element={<CaptainAvailable />} />
          <Route path="active" element={<CaptainActive />} />
          <Route path="history" element={<CaptainHistory />} />
          <Route path="wallet" element={<CaptainWallet />} />
          <Route path="profile" element={<CaptainProfile />} />
        </Route>
        <Route path="*" element={<Root />} />
      </Routes>
      <DemoPanel />
      <Toaster dir="rtl" position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }} />
    </>
  )
}
