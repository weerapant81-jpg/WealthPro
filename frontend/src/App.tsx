import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ClientProvider, useClient } from './context/ClientContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import IncomePage from './pages/IncomePage'
import RetirementPlanPage from './pages/RetirementPlanPage'
import InsurancePlanPage from './pages/InsurancePlanPage'
import EducationPlanPage from './pages/EducationPlanPage'
import FinancialPlanPage from './pages/FinancialPlanPage'
import UserProfilePage from './pages/UserProfilePage'
import CalculatorPage from './pages/CalculatorPage'
import ReportPage from './pages/ReportPage'
import ProjectionPage from './pages/ProjectionPage'
import SettingsPage from './pages/SettingsPage'
import ClientProfilePage from './pages/ClientProfilePage'
import AdminPage from './pages/AdminPage'
import RiskAssessmentPage from './pages/RiskAssessmentPage'
import TaxPlanningPage from './pages/TaxPlanningPage'
import InvestmentAssumptionPage from './pages/InvestmentAssumptionPage'
import ClientsPage from './pages/ClientsPage'
import ActionPlanPage from './pages/ActionPlanPage'
import ForwardCashflowPage from './pages/ForwardCashflowPage'

const qc = new QueryClient()

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
            </Routes>
          </BrowserRouter>
        </ClientProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
