import { Router } from 'express'
import { register, login, googleAuth, appleAuth, refresh, me, verifyEmail, resendVerify, forgotPassword, resetPassword, getAdvisorProfile, saveAdvisorProfile } from '../controllers/auth.controller'
import { getClientProfile, upsertClientProfile } from '../controllers/client.controller'
import { listUsers, approveUser, rejectUser, archiveUser, unarchiveUser, listClients, getAdvisorSummary, getPlanReviews, createClient, updateClient, deleteClient, setUserPlan } from '../controllers/admin.controller'
import {
  getAppointments, createAppointment, updateAppointment, deleteAppointment,
  getTasks, createTask, updateTask, deleteTask,
} from '../controllers/advisor.controller'
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../controllers/announcement.controller'
import { listActionItems, createActionItem, updateActionItem, deleteActionItem, setPlanReviewDate, setActionPlanAdvice } from '../controllers/actionplan.controller'
import {
  getIncomes, createIncome, updateIncome, deleteIncome,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getAssets, createAsset, updateAsset, deleteAsset,
  getLiabilities, createLiability, updateLiability, deleteLiability,
  getGoals, createGoal, updateGoal, deleteGoal,
  getProfile, upsertProfile, getAssumptionDefaults, setAssumptionDefaults,
  getRetirementPlan, saveRetirementPlan,
  getPvdPlan, savePvdPlan,
  getSsoPlan, saveSsoPlan,
  getSeverancePlan, saveSeverancePlan,
  getCashflowPlan, saveCashflowPlan,
  getEstatePlan, saveEstatePlan,
  getInsurancePlan, saveInsurancePlan,
  getEducationPlan, saveEducationPlan,
  getTaxPlan, saveTaxPlan,
  getReportPlan, saveReportPlan,
  getFinancialRatios,
  getLifeInsurances, createLifeInsurance, updateLifeInsurance, deleteLifeInsurance,
  getAllRiders, getRiders, createRider, updateRider, deleteRider,
  getBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary,
  getPropertyInsurances, createPropertyInsurance, updatePropertyInsurance, deletePropertyInsurance, getRebalancePlan, saveRebalancePlan
} from '../controllers/finance.controller'
import { getProjection } from '../controllers/projection.controller'
import { getMarketData, refreshMarketData } from '../controllers/marketdata.controller'
import { getInvestmentProfile, upsertInvestmentProfile } from '../controllers/investmentprofile.controller'
import { getMarketReturns, getAssetReturn } from '../controllers/marketreturns.controller'
import { quoteSymbol, annualReturn } from '../controllers/settrade.controller'
import { chatCopilot } from '../controllers/copilot.controller'
import { listAuditLogs } from '../controllers/audit.controller'
import { exportClient } from '../controllers/admin.controller'
import { status2fa, setup2fa, enable2fa, disable2fa } from '../controllers/twofa.controller'
import { getConsent, grantConsent, revokeConsent } from '../controllers/consent.controller'
import { createGameLead, listGameLeads, updateGameLead } from '../controllers/gamelead.controller'
import { authenticate, requireAdmin, requireSuperAdmin, requirePlan } from '../middleware/auth'

// กั้นตามแพ็กเกจ
const proOnly = requirePlan('pro')      // Pro ขึ้นไป
const aiOnly = requirePlan('copilot')   // เฉพาะ AI

const r = Router()

// เกมเศรษฐี (/game) — ฟอร์ม lead เป็น public (มี throttle ในตัว) · รายการ lead เฉพาะ FA
r.post('/game/lead', createGameLead)
r.get('/game/leads', authenticate, requireAdmin, listGameLeads)
r.put('/game/leads/:id', authenticate, requireAdmin, updateGameLead)

// Auth
r.post('/auth/register', register)
r.post('/auth/login', login)
r.post('/auth/google', googleAuth)
r.post('/auth/apple', appleAuth)
r.post('/auth/refresh', refresh)

// AI Copilot
r.post('/copilot/chat', authenticate, aiOnly, chatCopilot)
r.get('/auth/me', authenticate, me)
// 2FA (TOTP) — บัญชี FA
r.get('/auth/2fa/status', authenticate, status2fa)
r.post('/auth/2fa/setup', authenticate, setup2fa)
r.post('/auth/2fa/enable', authenticate, enable2fa)
r.post('/auth/2fa/disable', authenticate, disable2fa)
r.get('/advisor-profile', authenticate, getAdvisorProfile)
r.put('/advisor-profile', authenticate, saveAdvisorProfile)
r.get('/auth/verify-email', verifyEmail)
r.post('/auth/resend-verify', resendVerify)
r.post('/auth/forgot-password', forgotPassword)
r.post('/auth/reset-password', resetPassword)

// อนุมัติการสมัครนักวางแผน (FA) — เฉพาะผู้ให้บริการ (SUPER_ADMIN)
r.get('/admin/users', authenticate, requireSuperAdmin, listUsers)
r.put('/admin/users/:id/approve', authenticate, requireSuperAdmin, approveUser)
r.put('/admin/users/:id/archive', authenticate, requireSuperAdmin, archiveUser)
r.put('/admin/users/:id/unarchive', authenticate, requireSuperAdmin, unarchiveUser)
r.patch('/admin/users/:id/plan', authenticate, requireSuperAdmin, setUserPlan)
r.get('/clients', authenticate, requireAdmin, listClients)
r.post('/clients', authenticate, requireAdmin, createClient)
r.put('/clients/:id', authenticate, requireAdmin, updateClient)
r.delete('/clients/:id', authenticate, requireAdmin, deleteClient)
// PDPA: สิทธิ์เข้าถึง/พกพา (export) + ความยินยอม (consent)
r.get('/clients/:id/export', authenticate, requireAdmin, exportClient)
r.get('/clients/:id/consent', authenticate, requireAdmin, getConsent)
r.post('/clients/:id/consent', authenticate, requireAdmin, grantConsent)
r.post('/clients/:id/consent/revoke', authenticate, requireAdmin, revokeConsent)
r.get('/advisor/summary', authenticate, requireAdmin, getAdvisorSummary)
r.get('/advisor/plan-reviews', authenticate, requireAdmin, getPlanReviews)

// PDPA audit log — FA เห็นของตัวเอง · SUPER_ADMIN เห็นทั้งหมด
r.get('/audit-logs', authenticate, requireAdmin, listAuditLogs)

// นัดหมาย + งาน ของนักวางแผน (FA) เอง
r.get('/appointments', authenticate, requireAdmin, getAppointments)
r.post('/appointments', authenticate, requireAdmin, createAppointment)
r.put('/appointments/:id', authenticate, requireAdmin, updateAppointment)
r.delete('/appointments/:id', authenticate, requireAdmin, deleteAppointment)
r.get('/tasks', authenticate, requireAdmin, getTasks)
r.post('/tasks', authenticate, requireAdmin, createTask)
r.put('/tasks/:id', authenticate, requireAdmin, updateTask)
r.delete('/tasks/:id', authenticate, requireAdmin, deleteTask)

// ข่าว/ประกาศ — FA อ่านได้ · เฉพาะผู้ให้บริการ (SUPER_ADMIN) โพสต์/แก้/ลบ
r.get('/announcements', authenticate, requireAdmin, getAnnouncements)
r.post('/announcements', authenticate, requireSuperAdmin, createAnnouncement)
r.put('/announcements/:id', authenticate, requireSuperAdmin, updateAnnouncement)
r.delete('/announcements/:id', authenticate, requireSuperAdmin, deleteAnnouncement)
r.delete('/admin/users/:id', authenticate, requireSuperAdmin, rejectUser)

// Finance (all protected)
r.get('/incomes', authenticate, getIncomes)
r.post('/incomes', authenticate, createIncome)
r.put('/incomes/:id', authenticate, updateIncome)
r.delete('/incomes/:id', authenticate, deleteIncome)

r.get('/expenses', authenticate, getExpenses)
r.post('/expenses', authenticate, createExpense)
r.put('/expenses/:id', authenticate, updateExpense)
r.delete('/expenses/:id', authenticate, deleteExpense)

r.get('/assets', authenticate, getAssets)
r.post('/assets', authenticate, createAsset)
r.put('/assets/:id', authenticate, updateAsset)
r.delete('/assets/:id', authenticate, deleteAsset)

r.get('/liabilities', authenticate, getLiabilities)
r.post('/liabilities', authenticate, createLiability)
r.put('/liabilities/:id', authenticate, updateLiability)
r.delete('/liabilities/:id', authenticate, deleteLiability)

r.get('/goals', authenticate, getGoals)
r.post('/goals', authenticate, createGoal)
r.put('/goals/:id', authenticate, updateGoal)
r.delete('/goals/:id', authenticate, deleteGoal)

r.get('/profile', authenticate, getProfile)
r.put('/profile', authenticate, upsertProfile)
r.get('/assumption-defaults', authenticate, requireAdmin, getAssumptionDefaults)
r.put('/assumption-defaults', authenticate, requireSuperAdmin, setAssumptionDefaults)

r.get('/retirement-plan', authenticate, proOnly, getRetirementPlan)
r.put('/retirement-plan', authenticate, proOnly, saveRetirementPlan)

r.get('/pvd-plan', authenticate, proOnly, getPvdPlan)
r.put('/pvd-plan', authenticate, proOnly, savePvdPlan)

r.get('/sso-plan', authenticate, proOnly, getSsoPlan)
r.put('/sso-plan', authenticate, proOnly, saveSsoPlan)

r.get('/severance-plan', authenticate, proOnly, getSeverancePlan)
r.put('/severance-plan', authenticate, proOnly, saveSeverancePlan)

r.get('/cashflow-plan', authenticate, proOnly, getCashflowPlan)
r.put('/cashflow-plan', authenticate, proOnly, saveCashflowPlan)
r.get('/rebalance-plan', authenticate, proOnly, getRebalancePlan)
r.put('/rebalance-plan', authenticate, proOnly, saveRebalancePlan)
r.get('/estate-plan', authenticate, proOnly, getEstatePlan)
r.put('/estate-plan', authenticate, proOnly, saveEstatePlan)
r.get('/action-items', authenticate, proOnly, listActionItems)
r.post('/action-items', authenticate, proOnly, createActionItem)
r.patch('/action-items/:id', authenticate, proOnly, updateActionItem)
r.delete('/action-items/:id', authenticate, proOnly, deleteActionItem)
r.put('/plan-review-date', authenticate, proOnly, setPlanReviewDate)
r.put('/action-plan-advice', authenticate, proOnly, setActionPlanAdvice)

r.get('/insurance-plan', authenticate, proOnly, getInsurancePlan)
r.put('/insurance-plan', authenticate, proOnly, saveInsurancePlan)

r.get('/education-plan', authenticate, proOnly, getEducationPlan)
r.put('/education-plan', authenticate, proOnly, saveEducationPlan)

r.get('/tax-plan', authenticate, proOnly, getTaxPlan)
r.put('/tax-plan', authenticate, proOnly, saveTaxPlan)

r.get('/report-plan', authenticate, proOnly, getReportPlan)
r.put('/report-plan', authenticate, proOnly, saveReportPlan)

r.get('/projection', authenticate, getProjection)
r.get('/financial-ratios', authenticate, getFinancialRatios)

r.get('/life-insurances', authenticate, getLifeInsurances)
r.post('/life-insurances', authenticate, createLifeInsurance)
r.put('/life-insurances/:id', authenticate, updateLifeInsurance)
r.delete('/life-insurances/:id', authenticate, deleteLifeInsurance)

r.get('/all-riders', authenticate, getAllRiders)
r.get('/life-insurances/:policyId/riders', authenticate, getRiders)
r.post('/life-insurances/:policyId/riders', authenticate, createRider)
r.put('/riders/:riderId', authenticate, updateRider)
r.delete('/riders/:riderId', authenticate, deleteRider)

r.get('/life-insurances/:policyId/beneficiaries', authenticate, getBeneficiaries)
r.post('/life-insurances/:policyId/beneficiaries', authenticate, createBeneficiary)
r.put('/beneficiaries/:beneficiaryId', authenticate, updateBeneficiary)
r.delete('/beneficiaries/:beneficiaryId', authenticate, deleteBeneficiary)

r.get('/property-insurances', authenticate, getPropertyInsurances)
r.post('/property-insurances', authenticate, createPropertyInsurance)
r.put('/property-insurances/:id', authenticate, updatePropertyInsurance)
r.delete('/property-insurances/:id', authenticate, deletePropertyInsurance)

r.get('/client-profile', authenticate, getClientProfile)
r.put('/client-profile', authenticate, upsertClientProfile)

r.get('/market-data', authenticate, getMarketData)
r.post('/market-data/refresh', authenticate, refreshMarketData)

r.get('/investment-profile', authenticate, getInvestmentProfile)
r.put('/investment-profile', authenticate, upsertInvestmentProfile)
r.get('/market-returns', authenticate, getMarketReturns)
r.post('/asset-return', authenticate, getAssetReturn)

// Settrade Open API
r.get('/settrade/quote/:symbol', authenticate, quoteSymbol)
r.get('/settrade/annual-return/:symbol', authenticate, annualReturn)

export default r

