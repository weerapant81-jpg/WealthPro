import { Router } from 'express'
import { register, login, googleAuth, appleAuth, refresh, me, verifyEmail, resendVerify, forgotPassword, resetPassword, getAdvisorProfile, saveAdvisorProfile } from '../controllers/auth.controller'
import { getClientProfile, upsertClientProfile } from '../controllers/client.controller'
import { listUsers, approveUser, rejectUser, archiveUser, unarchiveUser, listClients, getAdvisorSummary, getPlanReviews, createClient, updateClient, deleteClient, setUserPlan, inviteClient } from '../controllers/admin.controller'
import { createClientRequest, listMyRequests, listAdvisorRequests, updateAdvisorRequest } from '../controllers/clientrequest.controller'
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
import { getThaiInflationRef } from '../lib/inflation'
import { validate } from '../lib/validate'
import {
  registerSchema, loginSchema, emailOnlySchema, resetPasswordSchema, googleAuthSchema, appleAuthSchema,
  refreshSchema, twoFactorEnableSchema, twoFactorDisableSchema, gameLeadSchema, checkoutSchema, setPlanSchema,
} from '../lib/schemas'
import {
  jsonBlobSchema, incomeSchema, expenseSchema, assetSchema, liabilitySchema, goalSchema,
  appointmentSchema, taskSchema, announcementSchema, actionItemSchema, planReviewDateSchema,
  lifeInsuranceSchema, propertyInsuranceSchema, clientSchema, tutorialSchema, gameLeadUpdateSchema,
  consentSchema, copilotChatSchema, assetReturnSchema, profileSchema,
} from '../lib/schemasAuth'
import { getSavingRatesRef } from '../lib/savingRates'
import { chatCopilot } from '../controllers/copilot.controller'
import { createCheckout, createPortal } from '../controllers/billing.controller'
import { listTutorials, createTutorial, updateTutorial, deleteTutorial } from '../controllers/tutorial.controller'
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
r.post('/game/lead', validate(gameLeadSchema), createGameLead)
// lead จากเกม (public lead magnet) เป็นของแพลตฟอร์ม → เฉพาะผู้ให้บริการ (SUPER_ADMIN)
r.get('/game/leads', authenticate, requireSuperAdmin, listGameLeads)
r.put('/game/leads/:id', authenticate, requireSuperAdmin, validate(gameLeadUpdateSchema), updateGameLead)

// วิดีโอสอนการใช้งาน — ดูได้ทุกคน (รวม guest) · จัดการเฉพาะ SUPER_ADMIN
r.get('/tutorials', listTutorials)
r.post('/tutorials', authenticate, requireSuperAdmin, validate(tutorialSchema), createTutorial)
r.patch('/tutorials/:id', authenticate, requireSuperAdmin, validate(tutorialSchema), updateTutorial)
r.delete('/tutorials/:id', authenticate, requireSuperAdmin, deleteTutorial)

// Auth
r.post('/auth/register', validate(registerSchema), register)
r.post('/auth/login', validate(loginSchema), login)
r.post('/auth/google', validate(googleAuthSchema), googleAuth)
r.post('/auth/apple', validate(appleAuthSchema), appleAuth)
r.post('/auth/refresh', validate(refreshSchema), refresh)

// AI Copilot
r.post('/copilot/chat', authenticate, aiOnly, validate(copilotChatSchema), chatCopilot)

// Billing (Stripe) — webhook แยกไปที่ index.ts (raw body)
r.post('/billing/checkout', authenticate, validate(checkoutSchema), createCheckout)
r.post('/billing/portal', authenticate, createPortal)
r.get('/auth/me', authenticate, me)
// 2FA (TOTP) — บัญชี FA
r.get('/auth/2fa/status', authenticate, status2fa)
r.post('/auth/2fa/setup', authenticate, setup2fa)
r.post('/auth/2fa/enable', authenticate, validate(twoFactorEnableSchema), enable2fa)
r.post('/auth/2fa/disable', authenticate, validate(twoFactorDisableSchema), disable2fa)
r.get('/advisor-profile', authenticate, getAdvisorProfile)
r.put('/advisor-profile', authenticate, validate(jsonBlobSchema), saveAdvisorProfile)
r.get('/auth/verify-email', verifyEmail)
r.post('/auth/resend-verify', validate(emailOnlySchema), resendVerify)
r.post('/auth/forgot-password', validate(emailOnlySchema), forgotPassword)
r.post('/auth/reset-password', validate(resetPasswordSchema), resetPassword)

// อนุมัติการสมัครนักวางแผน (FA) — เฉพาะผู้ให้บริการ (SUPER_ADMIN)
r.get('/admin/users', authenticate, requireSuperAdmin, listUsers)
r.put('/admin/users/:id/approve', authenticate, requireSuperAdmin, approveUser)
r.put('/admin/users/:id/archive', authenticate, requireSuperAdmin, archiveUser)
r.put('/admin/users/:id/unarchive', authenticate, requireSuperAdmin, unarchiveUser)
r.patch('/admin/users/:id/plan', authenticate, requireSuperAdmin, validate(setPlanSchema), setUserPlan)
r.get('/clients', authenticate, requireAdmin, listClients)
r.post('/clients', authenticate, requireAdmin, validate(clientSchema), createClient)
r.put('/clients/:id', authenticate, requireAdmin, validate(clientSchema), updateClient)
r.delete('/clients/:id', authenticate, requireAdmin, deleteClient)
r.post('/clients/:id/invite', authenticate, requireAdmin, proOnly, inviteClient)   // เชิญเข้า client portal (เฉพาะ Pro/AI)

// ── Client portal: ลูกค้าส่ง/ดูคำแจ้งถึง FA · FA ดู/อัปเดตสถานะ ──
r.post('/client/requests', authenticate, createClientRequest)
r.get('/client/requests', authenticate, listMyRequests)
r.get('/advisor/client-requests', authenticate, requireAdmin, listAdvisorRequests)
r.patch('/advisor/client-requests/:id', authenticate, requireAdmin, updateAdvisorRequest)
// PDPA: สิทธิ์เข้าถึง/พกพา (export) + ความยินยอม (consent)
r.get('/clients/:id/export', authenticate, requireAdmin, exportClient)
r.get('/clients/:id/consent', authenticate, requireAdmin, getConsent)
r.post('/clients/:id/consent', authenticate, requireAdmin, validate(consentSchema), grantConsent)
r.post('/clients/:id/consent/revoke', authenticate, requireAdmin, revokeConsent)
r.get('/advisor/summary', authenticate, requireAdmin, getAdvisorSummary)
r.get('/advisor/plan-reviews', authenticate, requireAdmin, getPlanReviews)

// PDPA audit log — FA เห็นของตัวเอง · SUPER_ADMIN เห็นทั้งหมด
r.get('/audit-logs', authenticate, requireAdmin, listAuditLogs)

// นัดหมาย + งาน ของนักวางแผน (FA) เอง
r.get('/appointments', authenticate, requireAdmin, getAppointments)
r.post('/appointments', authenticate, requireAdmin, validate(appointmentSchema), createAppointment)
r.put('/appointments/:id', authenticate, requireAdmin, validate(appointmentSchema), updateAppointment)
r.delete('/appointments/:id', authenticate, requireAdmin, deleteAppointment)
r.get('/tasks', authenticate, requireAdmin, getTasks)
r.post('/tasks', authenticate, requireAdmin, validate(taskSchema), createTask)
r.put('/tasks/:id', authenticate, requireAdmin, validate(taskSchema), updateTask)
r.delete('/tasks/:id', authenticate, requireAdmin, deleteTask)

// ข่าว/ประกาศ — FA อ่านได้ · เฉพาะผู้ให้บริการ (SUPER_ADMIN) โพสต์/แก้/ลบ
r.get('/announcements', authenticate, requireAdmin, getAnnouncements)
r.post('/announcements', authenticate, requireSuperAdmin, validate(announcementSchema), createAnnouncement)
r.put('/announcements/:id', authenticate, requireSuperAdmin, validate(announcementSchema), updateAnnouncement)
r.delete('/announcements/:id', authenticate, requireSuperAdmin, deleteAnnouncement)
r.delete('/admin/users/:id', authenticate, requireSuperAdmin, rejectUser)

// Finance (all protected)
r.get('/incomes', authenticate, getIncomes)
r.post('/incomes', authenticate, validate(incomeSchema), createIncome)
r.put('/incomes/:id', authenticate, validate(incomeSchema), updateIncome)
r.delete('/incomes/:id', authenticate, deleteIncome)

r.get('/expenses', authenticate, getExpenses)
r.post('/expenses', authenticate, validate(expenseSchema), createExpense)
r.put('/expenses/:id', authenticate, validate(expenseSchema), updateExpense)
r.delete('/expenses/:id', authenticate, deleteExpense)

r.get('/assets', authenticate, getAssets)
r.post('/assets', authenticate, validate(assetSchema), createAsset)
r.put('/assets/:id', authenticate, validate(assetSchema), updateAsset)
r.delete('/assets/:id', authenticate, deleteAsset)

r.get('/liabilities', authenticate, getLiabilities)
r.post('/liabilities', authenticate, validate(liabilitySchema), createLiability)
r.put('/liabilities/:id', authenticate, validate(liabilitySchema), updateLiability)
r.delete('/liabilities/:id', authenticate, deleteLiability)

r.get('/goals', authenticate, getGoals)
r.post('/goals', authenticate, validate(goalSchema), createGoal)
r.put('/goals/:id', authenticate, validate(goalSchema), updateGoal)
r.delete('/goals/:id', authenticate, deleteGoal)

r.get('/profile', authenticate, getProfile)
r.put('/profile', authenticate, validate(profileSchema), upsertProfile)
// อัตราเงินเฟ้ออ้างอิง (World Bank) — ข้อมูลสาธารณะ ไม่ผูกกับลูกค้า ใช้ประกอบการตั้งสมมติฐาน
r.get('/reference/inflation', authenticate, async (_req, res) => {
  const data = await getThaiInflationRef()
  if (!data) return res.status(503).json({ error: 'INFLATION_REF_UNAVAILABLE' })
  res.json(data)
})
// อัตราดอกเบี้ยการออมอ้างอิง (ธปท.) — แสดงอย่างเดียว ไม่ผูกกับลูกค้า
r.get('/reference/saving-rates', authenticate, async (_req, res) => {
  const data = await getSavingRatesRef()
  if (!data) return res.status(503).json({ error: 'SAVING_RATES_UNAVAILABLE' })
  res.json(data)
})
r.get('/assumption-defaults', authenticate, requireAdmin, getAssumptionDefaults)
r.put('/assumption-defaults', authenticate, requireSuperAdmin, validate(profileSchema), setAssumptionDefaults)

r.get('/retirement-plan', authenticate, proOnly, getRetirementPlan)
r.put('/retirement-plan', authenticate, proOnly, validate(jsonBlobSchema), saveRetirementPlan)

r.get('/pvd-plan', authenticate, proOnly, getPvdPlan)
r.put('/pvd-plan', authenticate, proOnly, validate(jsonBlobSchema), savePvdPlan)

r.get('/sso-plan', authenticate, proOnly, getSsoPlan)
r.put('/sso-plan', authenticate, proOnly, validate(jsonBlobSchema), saveSsoPlan)

r.get('/severance-plan', authenticate, proOnly, getSeverancePlan)
r.put('/severance-plan', authenticate, proOnly, validate(jsonBlobSchema), saveSeverancePlan)

r.get('/cashflow-plan', authenticate, proOnly, getCashflowPlan)
r.put('/cashflow-plan', authenticate, proOnly, validate(jsonBlobSchema), saveCashflowPlan)
r.get('/rebalance-plan', authenticate, proOnly, getRebalancePlan)
r.put('/rebalance-plan', authenticate, proOnly, validate(jsonBlobSchema), saveRebalancePlan)
r.get('/estate-plan', authenticate, proOnly, getEstatePlan)
r.put('/estate-plan', authenticate, proOnly, validate(jsonBlobSchema), saveEstatePlan)
r.get('/action-items', authenticate, proOnly, listActionItems)
r.post('/action-items', authenticate, proOnly, validate(actionItemSchema), createActionItem)
r.patch('/action-items/:id', authenticate, proOnly, validate(actionItemSchema), updateActionItem)
r.delete('/action-items/:id', authenticate, proOnly, deleteActionItem)
r.put('/plan-review-date', authenticate, proOnly, validate(planReviewDateSchema), setPlanReviewDate)
r.put('/action-plan-advice', authenticate, proOnly, validate(jsonBlobSchema), setActionPlanAdvice)

r.get('/insurance-plan', authenticate, proOnly, getInsurancePlan)
r.put('/insurance-plan', authenticate, proOnly, validate(jsonBlobSchema), saveInsurancePlan)

r.get('/education-plan', authenticate, proOnly, getEducationPlan)
r.put('/education-plan', authenticate, proOnly, validate(jsonBlobSchema), saveEducationPlan)

r.get('/tax-plan', authenticate, proOnly, getTaxPlan)
r.put('/tax-plan', authenticate, proOnly, validate(jsonBlobSchema), saveTaxPlan)

r.get('/report-plan', authenticate, proOnly, getReportPlan)
r.put('/report-plan', authenticate, proOnly, validate(jsonBlobSchema), saveReportPlan)

r.get('/projection', authenticate, getProjection)
r.get('/financial-ratios', authenticate, getFinancialRatios)

r.get('/life-insurances', authenticate, getLifeInsurances)
r.post('/life-insurances', authenticate, validate(lifeInsuranceSchema), createLifeInsurance)
r.put('/life-insurances/:id', authenticate, validate(lifeInsuranceSchema), updateLifeInsurance)
r.delete('/life-insurances/:id', authenticate, deleteLifeInsurance)

r.get('/all-riders', authenticate, getAllRiders)
r.get('/life-insurances/:policyId/riders', authenticate, getRiders)
r.post('/life-insurances/:policyId/riders', authenticate, validate(jsonBlobSchema), createRider)
r.put('/riders/:riderId', authenticate, validate(jsonBlobSchema), updateRider)
r.delete('/riders/:riderId', authenticate, deleteRider)

r.get('/life-insurances/:policyId/beneficiaries', authenticate, getBeneficiaries)
r.post('/life-insurances/:policyId/beneficiaries', authenticate, validate(jsonBlobSchema), createBeneficiary)
r.put('/beneficiaries/:beneficiaryId', authenticate, validate(jsonBlobSchema), updateBeneficiary)
r.delete('/beneficiaries/:beneficiaryId', authenticate, deleteBeneficiary)

r.get('/property-insurances', authenticate, getPropertyInsurances)
r.post('/property-insurances', authenticate, validate(propertyInsuranceSchema), createPropertyInsurance)
r.put('/property-insurances/:id', authenticate, validate(propertyInsuranceSchema), updatePropertyInsurance)
r.delete('/property-insurances/:id', authenticate, deletePropertyInsurance)

r.get('/client-profile', authenticate, getClientProfile)
r.put('/client-profile', authenticate, validate(jsonBlobSchema), upsertClientProfile)

r.get('/market-data', authenticate, getMarketData)
r.post('/market-data/refresh', authenticate, refreshMarketData)

r.get('/investment-profile', authenticate, getInvestmentProfile)
r.put('/investment-profile', authenticate, validate(jsonBlobSchema), upsertInvestmentProfile)
r.get('/market-returns', authenticate, getMarketReturns)
r.post('/asset-return', authenticate, validate(assetReturnSchema), getAssetReturn)

// Settrade Open API
r.get('/settrade/quote/:symbol', authenticate, quoteSymbol)
r.get('/settrade/annual-return/:symbol', authenticate, annualReturn)

export default r

