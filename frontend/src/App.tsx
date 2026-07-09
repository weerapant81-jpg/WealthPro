import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

const qc = new QueryClient()

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

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ClientProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
              <Route path="/income" element={<ClientRoute><IncomePage /></ClientRoute>} />
              <Route path="/financial-plan" element={<ClientRoute><FinancialPlanPage /></ClientRoute>} />
              <Route path="/action-plan" element={<ClientRoute><ActionPlanPage /></ClientRoute>} />
              <Route path="/goals" element={<ClientRoute><RetirementPlanPage /></ClientRoute>} />
              <Route path="/education" element={<ClientRoute><EducationPlanPage /></ClientRoute>} />
              <Route path="/insurance-plan" element={<ClientRoute><InsurancePlanPage /></ClientRoute>} />
              <Route path="/projection" element={<ClientRoute><ProjectionPage /></ClientRoute>} />
              <Route path="/settings" element={<ClientRoute><SettingsPage /></ClientRoute>} />
              <Route path="/user-profile" element={<PrivateRoute><UserProfilePage /></PrivateRoute>} />
              <Route path="/calculator" element={<PrivateRoute><CalculatorPage /></PrivateRoute>} />
              <Route path="/report" element={<ClientRoute><ReportPage /></ClientRoute>} />
              <Route path="/client" element={<ClientRoute><ClientProfilePage /></ClientRoute>} />
              <Route path="/admin" element={<SuperAdminRoute><AdminPage /></SuperAdminRoute>} />
              <Route path="/risk" element={<ClientRoute><RiskAssessmentPage /></ClientRoute>} />
              <Route path="/tax" element={<ClientRoute><TaxPlanningPage /></ClientRoute>} />
              <Route path="/forward-cashflow" element={<ClientRoute><ForwardCashflowPage /></ClientRoute>} />
              <Route path="/investment" element={<PrivateRoute><InvestmentAssumptionPage /></PrivateRoute>} />
              <Route path="/clients" element={<AdminRoute><ClientsPage /></AdminRoute>} />
              <Route path="/audit-log" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
              <Route path="/privacy" element={<PrivateRoute><PrivacyPolicyPage /></PrivateRoute>} />
              <Route path="/terms" element={<PrivateRoute><TermsOfServicePage /></PrivateRoute>} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </ClientProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
