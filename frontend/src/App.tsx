import { lazy, Suspense, Component, useEffect, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ConnectionStatus from './components/ConnectionStatus'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ClientProvider, useClient } from './context/ClientContext'
import Layout from './components/Layout'
// LoginPage โหลดทันที (หน้าแรกของผู้ยังไม่ล็อกอิน) — ที่เหลือ lazy แยกเป็น chunk ต่อหน้า
import LoginPage from './pages/LoginPage'
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const IncomePage = lazy(() => import('./pages/IncomePage'))
const RetirementPlanPage = lazy(() => import('./pages/RetirementPlanPage'))
const InsurancePlanPage = lazy(() => import('./pages/InsurancePlanPage'))
const EducationPlanPage = lazy(() => import('./pages/EducationPlanPage'))
const FinancialPlanPage = lazy(() => import('./pages/FinancialPlanPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const CalculatorPage = lazy(() => import('./pages/CalculatorPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const ProjectionPage = lazy(() => import('./pages/ProjectionPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ClientProfilePage = lazy(() => import('./pages/ClientProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const RiskAssessmentPage = lazy(() => import('./pages/RiskAssessmentPage'))
const TaxPlanningPage = lazy(() => import('./pages/TaxPlanningPage'))
const InvestmentAssumptionPage = lazy(() => import('./pages/InvestmentAssumptionPage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const ActionPlanPage = lazy(() => import('./pages/ActionPlanPage'))
const ForwardCashflowPage = lazy(() => import('./pages/ForwardCashflowPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const UserGuidePage = lazy(() => import('./pages/UserGuidePage'))
const GamePage = lazy(() => import('./pages/game/GamePage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const InstallGuidePage = lazy(() => import('./pages/InstallGuidePage'))
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const TutorialsPage = lazy(() => import('./pages/TutorialsPage'))

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx = เราส่งผิดเอง ลองซ้ำก็ได้ผลเดิม · ปัญหาเครือข่าย/5xx ค่อยลองซ้ำแบบถอยห่างขึ้นเรื่อย ๆ
      retry: (count, err: any) => {
        const st = err?.response?.status
        if (st && st >= 400 && st < 500 && st !== 408 && st !== 429) return false
        return count < 3
      },
      retryDelay: i => Math.min(1000 * 2 ** i, 15000),
    },
  },
})

// fallback ระหว่างโหลด chunk ของแต่ละหน้า
function PageLoader() {
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>กำลังโหลด...</div>
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

// เปิดจากแอปที่ติดตั้งลงหน้าจอโฮม (PWA standalone) หรือไม่
const isInstalledApp = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true)

// หน้าแรก "/" — ล็อกอินแล้ว = แดชบอร์ด · ยังไม่ล็อกอิน: เปิดจากแอปติดตั้ง → ไป login เลย (ข้ามหน้าขาย) · เปิดจากเบราว์เซอร์ → หน้า landing
function HomeRoute() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return isInstalledApp() ? <Navigate to="/login" replace /> : <LandingPage />
  return <Layout><DashboardPage /></Layout>
}

// ศูนย์เรียนรู้ — ล็อกอิน = ในแอป (Layout+sidebar) · guest = หน้าจัดการเมนูเอง (marketing shell)
function TutorialsRoute() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return user ? <Layout><TutorialsPage /></Layout> : <TutorialsPage />
}

// หน้าเอกสาร (นโยบาย/ข้อกำหนด) — เข้าได้ทั้งสาธารณะ (จาก landing) และในแอป
function DocRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Layout>{children}</Layout>
  return (
    <div style={{ background: 'var(--navy-900)', minHeight: '100vh', fontFamily: "'Sarabun', sans-serif" }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px 64px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 20 }}>← กลับหน้าแรก</a>
        {children}
      </div>
    </div>
  )
}

// หน้าที่ผูกกับ "ลูกค้า" — FA (admin) ต้องเลือกลูกค้าก่อน ไม่งั้นเด้งไปหน้าเลือกลูกค้า (กัน effectiveUserId undefined → 500)
function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { selectedClient } = useClient()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>
  if (!user) return <Navigate to="/login" replace />
  if (isAdvisor(user.role) && !selectedClient) return <Navigate to="/clients" replace />
  return <Layout>{children}</Layout>
}

// FA (ADMIN) และผู้ให้บริการ (SUPER_ADMIN) = "นักวางแผน" ที่มีสิทธิ์เต็ม
export const isAdvisor = (role?: string) => role === 'ADMIN' || role === 'SUPER_ADMIN'

// หน้าที่ผูกกับลูกค้า + ต้องมีแพ็กเกจ (Pro/AI) — Free ถูกเด้งไป /pricing
function PlanRoute({ children, feature = 'pro' }: { children: React.ReactNode; feature?: 'pro' | 'ai' }) {
  const { user, loading } = useAuth()
  const { selectedClient } = useClient()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>
  if (!user) return <Navigate to="/login" replace />
  const full = user.role === 'SUPER_ADMIN' || user.role === 'USER'
  const plan = full ? 'ai' : (user.plan || 'free')
  const ok = feature === 'ai' ? plan === 'ai' : (plan === 'pro' || plan === 'ai')
  if (!ok) return <Navigate to="/pricing" replace />
  if (isAdvisor(user.role) && !selectedClient) return <Navigate to="/clients" replace />
  return <Layout>{children}</Layout>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdvisor(user.role)) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

// เฉพาะผู้ให้บริการ (SUPER_ADMIN) — เช่น หน้าอนุมัตินักวางแผน
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

// จับ error ตอนโหลด chunk (เกิดหลัง deploy ใหม่ ระหว่างแอปเก่ายังเปิดอยู่) → โหลดหน้าใหม่ให้เนียน กันจอมืด
class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) {
    const msg = String((err as any)?.message || err)
    const isChunk = /dynamically imported module|Loading chunk|module script failed|Failed to fetch/i.test(msg)
    if (isChunk && !sessionStorage.getItem('wp_reloaded')) {
      sessionStorage.setItem('wp_reloaded', '1')
      window.location.reload()
      return
    }
    if (!isChunk) Sentry.captureException(err)   // error จริงของแอป → ส่งเข้า Sentry (chunk error ข้าม กัน noise)
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)', color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 15 }}>มีการอัปเดตเวอร์ชันใหม่ — กรุณาโหลดหน้าใหม่</div>
          <button onClick={() => { sessionStorage.removeItem('wp_reloaded'); window.location.reload() }}
            style={{ padding: '11px 24px', background: 'var(--cyan)', border: 'none', borderRadius: 10, color: '#00201d', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>โหลดใหม่</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  // แอปรันได้เกิน 5 วิ = โหลด chunk สำเร็จ → เคลียร์ธงกันลูป (ให้ deploy รอบถัดไป auto-reload ได้อีก)
  useEffect(() => { const t = setTimeout(() => sessionStorage.removeItem('wp_reloaded'), 5000); return () => clearTimeout(t) }, [])
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ClientProvider>
          <ConnectionStatus />
          <BrowserRouter>
            <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/game" element={<GamePage />} />
              <Route path="/install" element={<InstallGuidePage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/tutorials" element={<TutorialsRoute />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/" element={<HomeRoute />} />
              {/* หน้าขายแบบตายตัว — แสดงเสมอไม่ว่าจะล็อกอินอยู่หรือไม่ (ต่างจาก "/" ที่ล็อกอินแล้วจะเป็นแดชบอร์ด)
                  ใช้ส่งลิงก์ให้คนอื่นดู หรือให้ทีมตรวจหน้าขายโดยไม่ต้องออกจากระบบ */}
              <Route path="/home" element={<LandingPage />} />
              <Route path="/income" element={<ClientRoute><IncomePage /></ClientRoute>} />
              <Route path="/financial-plan" element={<PlanRoute><FinancialPlanPage /></PlanRoute>} />
              <Route path="/action-plan" element={<PlanRoute><ActionPlanPage /></PlanRoute>} />
              <Route path="/goals" element={<PlanRoute><RetirementPlanPage /></PlanRoute>} />
              <Route path="/education" element={<PlanRoute><EducationPlanPage /></PlanRoute>} />
              <Route path="/insurance-plan" element={<PlanRoute><InsurancePlanPage /></PlanRoute>} />
              <Route path="/projection" element={<PlanRoute><ProjectionPage /></PlanRoute>} />
              <Route path="/settings" element={<ClientRoute><SettingsPage /></ClientRoute>} />
              <Route path="/user-profile" element={<PrivateRoute><UserProfilePage /></PrivateRoute>} />
              <Route path="/calculator" element={<PrivateRoute><CalculatorPage /></PrivateRoute>} />
              <Route path="/report" element={<PlanRoute><ReportPage /></PlanRoute>} />
              <Route path="/client" element={<ClientRoute><ClientProfilePage /></ClientRoute>} />
              <Route path="/admin" element={<SuperAdminRoute><AdminPage /></SuperAdminRoute>} />
              <Route path="/risk" element={<ClientRoute><RiskAssessmentPage /></ClientRoute>} />
              <Route path="/tax" element={<PlanRoute><TaxPlanningPage /></PlanRoute>} />
              <Route path="/forward-cashflow" element={<PlanRoute><ForwardCashflowPage /></PlanRoute>} />
              <Route path="/investment" element={<PrivateRoute><InvestmentAssumptionPage /></PrivateRoute>} />
              <Route path="/clients" element={<AdminRoute><ClientsPage /></AdminRoute>} />
              <Route path="/audit-log" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
              <Route path="/privacy" element={<DocRoute><PrivacyPolicyPage /></DocRoute>} />
              <Route path="/terms" element={<DocRoute><TermsOfServicePage /></DocRoute>} />
              <Route path="/refund" element={<DocRoute><RefundPolicyPage /></DocRoute>} />
              <Route path="/pricing" element={<PrivateRoute><PricingPage /></PrivateRoute>} />
              <Route path="/guide" element={<PrivateRoute><UserGuidePage /></PrivateRoute>} />
            </Routes>
            </Suspense>
            </RouteErrorBoundary>
          </BrowserRouter>
        </ClientProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
