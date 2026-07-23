import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { FileText, Printer, Check, Loader2, FileStack, Presentation, Pencil, Download, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { useClient } from '../context/ClientContext'
import { PageHeader } from '../components/ui'
import PresentationDeck, { SlideEditor, OverlayLayer, DECK_SLIDES, type SlideEl, type CustomSlide } from './report/PresentationDeck'
import { useRetirementReadiness } from '../hooks/useRetirementReadiness'
import { useInsuranceReadiness } from '../hooks/useInsuranceReadiness'
import { useEducationReadiness } from '../hooks/useEducationReadiness'
import { hasSpouseInfo } from '../lib/spouse'
import { useInsuranceCoverage } from '../components/InsuranceCoverageSummary'
import { toNum } from '@shared/finance/math'
import Acknowledgement from './report/sections/Acknowledgement'
import Assumptions from './report/sections/Assumptions'
import type { ReportCtx } from './report/ctx'
import ServiceAgreement from './report/sections/ServiceAgreement'
import AdvisorProfile from './report/sections/AdvisorProfile'
import ActionPlanSummary from './report/sections/ActionPlanSummary'
import ClientGoals from './report/sections/ClientGoals'
import RetirementSection from './report/sections/RetirementSection'
import EducationSection from './report/sections/EducationSection'
import TaxSection from './report/sections/TaxSection'
import EstateSection from './report/sections/EstateSection'
import ExecutiveSummary from './report/sections/ExecutiveSummary'
import BasicInfo from './report/sections/BasicInfo'
import InsuranceSection from './report/sections/InsuranceSection'
import PortfolioReco from './report/sections/PortfolioReco'
import InvestmentAnalysis from './report/sections/InvestmentAnalysis'
import CurrentStatus from './report/sections/CurrentStatus'
import DomainAnalysis from './report/sections/DomainAnalysis'
import FinancialStatements from './report/sections/FinancialStatements'




interface Sec { k: string; t: string; lvl: 1 | 2; auto?: string }
const SECTIONS: Sec[] = [
  { k: 'service', t: 'ข้อตกลงในการให้บริการ', lvl: 1, auto: 'service' },
  { k: 'execsum', t: 'บทสรุปผู้บริหาร', lvl: 1, auto: 'execsum' },
  { k: 'actionplan', t: 'สรุปแผนดำเนินการ', lvl: 1, auto: 'actionplan' },
  { k: 'basicinfo', t: 'วิเคราะห์ข้อมูลพื้นฐาน', lvl: 1, auto: 'basicinfo' },
  { k: 'clientgoals', t: 'เป้าหมายทางการเงินของลูกค้า', lvl: 1, auto: 'goals' },
  { k: 'exec', t: 'สถานะทางการเงินปัจจุบัน', lvl: 1, auto: 'exec' },
  { k: 'exec_spouse', t: 'สถานะทางการเงินปัจจุบัน (คู่สมรส)', lvl: 1, auto: 'exec_spouse' },
  { k: 'domains', t: 'บทวิเคราะห์และการดำเนินการ', lvl: 1, auto: 'domains' },
  { k: 'domains_spouse', t: 'บทวิเคราะห์และการดำเนินการ (คู่สมรส)', lvl: 1, auto: 'domains_spouse' },
  { k: 'finance', t: 'สรุปผลการวิเคราะห์ข้อมูลทางการเงินส่วนบุคคล', lvl: 1, auto: 'finance' },
  { k: 'fin_cf2', t: 'งบกระแสเงินสด (Cash Flow Statement)', lvl: 2, auto: 'fin_cf2' },
  { k: 'fin_ratio2', t: 'อัตราส่วนทางการเงิน (Financial Ratio)', lvl: 2, auto: 'fin_ratio2' },
  { k: 'fin_invest', t: 'การวิเคราะห์สินทรัพย์ลงทุนที่มี', lvl: 2, auto: 'fin_invest' },
  { k: 'finance_sp', t: 'สรุปผลการวิเคราะห์ข้อมูลทางการเงินส่วนบุคคล (คู่สมรส)', lvl: 1, auto: 'finance_sp' },
  { k: 'fin_cf2_sp', t: 'งบกระแสเงินสด — คู่สมรส', lvl: 2, auto: 'fin_cf2_sp' },
  { k: 'fin_ratio2_sp', t: 'อัตราส่วนทางการเงิน — คู่สมรส', lvl: 2, auto: 'fin_ratio2_sp' },
  { k: 'fin_invest_sp', t: 'การวิเคราะห์สินทรัพย์ลงทุนที่มี — คู่สมรส', lvl: 2, auto: 'fin_invest_sp' },
  { k: 'g_insurance', t: 'การวิเคราะห์ความเสี่ยงภัยและความต้องการด้านการประกันภัย', lvl: 2, auto: 'insurance' },
  { k: 'g_education', t: 'เป้าหมายทางการเงินเพื่อการศึกษาบุตร', lvl: 2, auto: 'education' },
  { k: 'g_retire', t: 'ความต้องการทางการเงินเพื่อการเกษียณ', lvl: 2, auto: 'retirement' },
  { k: 'g_tax', t: 'การวิเคราะห์ภาษีเงินได้', lvl: 2, auto: 'taxfull' },
  { k: 'g_estate', t: 'แนวทางการจัดการทรัพย์สินและมรดก', lvl: 2, auto: 'estatefull' },
  { k: 'g_port_reco', t: 'พอร์ตการลงทุนที่แนะนำ', lvl: 2, auto: 'portfolio_reco' },
  { k: 'assumptions', t: 'สมมติฐานที่ใช้ในการวางแผน', lvl: 1, auto: 'assumptions' },
  { k: 'acknowledge2', t: 'ข้อควรทราบ', lvl: 1, auto: 'ack2' },
  { k: 'advprofile', t: 'ประวัตินักวางแผนการเงิน', lvl: 1, auto: 'advprofile' },
]

// หัวข้อที่ autoNode จัดการข้อความเองทั้งหมด (ช่องพิมพ์ = แก้ข้อความ default ไม่ใช่ต่อท้าย)
const TEXT_HANDLED = new Set(['exec', 'exec_spouse', 'advprofile'])




type SecData = { include: boolean; text: string }

export default function ReportPage() {
  const compact = useIsCompact()
  const { data: client } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: advisor } = useQuery({ queryKey: ['advisor-profile'], queryFn: () => api.get('/advisor-profile').then(r => r.data), retry: false })
  const { data: ratios } = useQuery({ queryKey: ['financial-ratios'], queryFn: () => api.get('/financial-ratios').then(r => r.data), retry: false })
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: retPlan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })
  const { data: eduPlan } = useQuery({ queryKey: ['education-plan'], queryFn: () => api.get('/education-plan').then(r => r.data), retry: false })
  const { selectedClient } = useClient()
  const clientKey = selectedClient?.id ?? 'none'
  const { data: saved, isFetched } = useQuery({ queryKey: ['report-plan', clientKey], queryFn: () => api.get('/report-plan').then(r => r.data), retry: false })
  const { data: taxPlanQ } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })
  const { data: actionData } = useQuery({ queryKey: ['action-items'], queryFn: () => api.get('/action-items').then(r => r.data), retry: false })
  const { data: expensesQ = [] } = useQuery<any[]>({ queryKey: ['expenses'], queryFn: () => api.get('/expenses').then(r => r.data), retry: false })
  const actionItems: any[] = Array.isArray(actionData) ? actionData : (actionData?.items ?? [])
  // คำแนะนำรายหมวดที่ที่ปรึกษาพิมพ์ไว้ในหน้าแผนปฏิบัติการ (แหล่งเดียวกัน — ไม่ต้องพิมพ์ซ้ำ)
  const domainAdvice: Record<string, string> = (!Array.isArray(actionData) && actionData?.advice) || {}
  // readiness กลาง (สูตรเดียวกับหน้าแผน/แผนปฏิบัติการ — กัน drift)
  const retR = useRetirementReadiness('client')
  const insR = useInsuranceReadiness('client')
  const eduR = useEducationReadiness()
  // ฝั่งคู่สมรส (ใช้เมื่อมีข้อมูลคู่สมรส)
  const retRSp = useRetirementReadiness('spouse')
  const insRSp = useInsuranceReadiness('spouse')
  const { data: ratiosSp } = useQuery({ queryKey: ['financial-ratios', 'spouse'], queryFn: () => api.get('/financial-ratios', { params: { person: 'spouse' } }).then(r => r.data), retry: false })
  const covSelf = useInsuranceCoverage('self')
  const covSp = useInsuranceCoverage('spouse')
  const { data: marketData } = useQuery({ queryKey: ['market-data'], queryFn: () => api.get('/market-data').then(r => r.data), staleTime: 5 * 60 * 1000, retry: 1 })
  const { data: estatePlanQ } = useQuery({ queryKey: ['estate-plan'], queryFn: () => api.get('/estate-plan').then(r => r.data), retry: false })
  const { data: rebalQ } = useQuery({ queryKey: ['rebalance-plan'], queryFn: () => api.get('/rebalance-plan').then(r => r.data), retry: false })

  const [title, setTitle] = useState('แผนการเงินส่วนบุคคล')
  const [mode, setMode] = useState<'full' | 'pres'>('full')
  const [pres, setPres] = useState<Record<string, { comment?: string; hidden?: boolean; off?: boolean }>>({})
  const [editMode, setEditMode] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)   // หุบเมนูเลือกหน้า เพื่อเพิ่มพื้นที่เอกสาร
  const [overlays, setOverlays] = useState<Record<string, SlideEl[]>>({})
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([])
  const [thankYouPhoto, setThankYouPhoto] = useState('')
  const [signatures, setSignatures] = useState<Record<string, string>>({})   // ลายเซ็นหน้าข้อตกลง (advisor/client/witness)
  const [signing, setSigning] = useState<string | null>(null)
  const [secs, setSecs] = useState<Record<string, SecData>>(() =>
    Object.fromEntries(SECTIONS.map(s => [s.k, { include: true, text: '' }])))
  const loadedRef = useRef(false)
  // เปลี่ยนลูกค้า → ล้างสถานะรายงานทั้งหมด (รวมลายเซ็น/ติ๊ก PDPA) แล้วโหลดแผนของลูกค้าคนใหม่
  const clientRef = useRef(clientKey)
  useEffect(() => {
    if (clientRef.current === clientKey) return
    clientRef.current = clientKey
    loadedRef.current = false
    setTitle('แผนการเงินส่วนบุคคล')
    setPres({}); setOverlays({}); setCustomSlides([]); setThankYouPhoto('')
    setSignatures({}); setSigning(null); setEditMode(false)
    setSecs(Object.fromEntries(SECTIONS.map(sc => [sc.k, { include: true, text: '' }])))
  }, [clientKey])
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    if (saved && typeof saved === 'object') {
      if (saved.title) setTitle(saved.title)
      if (saved.mode === 'pres' || saved.mode === 'full') setMode(saved.mode)
      if (saved.pres && typeof saved.pres === 'object') {
        const next: Record<string, { comment?: string; hidden?: boolean; off?: boolean }> = {}
        for (const k of Object.keys(saved.pres)) {
          const v = saved.pres[k]
          next[k] = typeof v === 'string' ? { comment: v } : (v || {})   // backward-compat: string → {comment}
        }
        setPres(next)
      }
      if (saved.overlays && typeof saved.overlays === 'object') setOverlays(saved.overlays)
      if (Array.isArray(saved.customSlides)) setCustomSlides(saved.customSlides)
      if (typeof saved.thankYouPhoto === 'string') setThankYouPhoto(saved.thankYouPhoto)
      if (saved.signatures && typeof saved.signatures === 'object') setSignatures(saved.signatures)
      if (saved.secs) setSecs(prev => {
        const next = { ...prev }
        for (const k of Object.keys(saved.secs)) next[k] = { ...next[k], ...saved.secs[k] }
        return next
      })
    }
    loadedRef.current = true
  }, [isFetched, saved])

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const save = useMutation({
    mutationFn: (payload: any) => api.put('/report-plan', payload),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: () => setStatus('idle'),
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate({ title, secs, mode, pres, overlays, customSlides, thankYouPhoto, signatures }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [title, secs, mode, pres, overlays, customSlides, thankYouPhoto, signatures])

  const setText = (k: string, v: string) => setSecs(p => ({ ...p, [k]: { ...p[k], text: v } }))
  const setInc = (k: string, v: boolean) => setSecs(p => ({ ...p, [k]: { ...p[k], include: v } }))

  const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(' ') || 'ลูกค้า'
  const age = client?.birthDate ? new Date().getFullYear() - new Date(client.birthDate).getFullYear() : null
  const sm = ratios?.summary ?? {}
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  // investment allocation by asset class
  const allocation = (() => {
    const assets: any[] = invProfile?.investmentAssets ?? []
    const groups: Record<string, number> = {}
    assets.forEach(a => { const v = toNum(a.currentValue); if (v > 0) groups[a.assetClass || 'อื่นๆ'] = (groups[a.assetClass || 'อื่นๆ'] || 0) + v })
    const total = Object.values(groups).reduce((s, v) => s + v, 0)
    return { rows: Object.entries(groups).map(([name, value]) => ({ name, value })), total }
  })()
  const PIE_COLORS = ['#0284c7', '#10b981', '#f59e0b', '#a78bfa', '#f87171', '#22d3ee', '#fb923c', '#34d399']

  // recompute inputs for plan-based sections
  const invAssets: any[] = invProfile?.investmentAssets ?? []
  const totalInv = invAssets.reduce((s, a) => s + toNum(a.currentValue), 0)
  let _wr = 0, _cv = 0
  invAssets.forEach(a => { const v = toNum(a.currentValue), rr = parseFloat(a.annualReturn); if (!isNaN(rr) && v > 0) { _cv += v; _wr += rr * v } })
  const portRet = _cv > 0 ? _wr / _cv : 0
  // สินทรัพย์ลงทุนฝั่งคู่สมรส
  const hasSpouse = hasSpouseInfo(client)
  const invAssetsSp: any[] = invProfile?.spouseData?.investmentAssets ?? []
  const totalInvSp = invAssetsSp.reduce((s, a) => s + toNum(a.currentValue), 0)
  let _wrS = 0, _cvS = 0
  invAssetsSp.forEach(a => { const v = toNum(a.currentValue), rr = parseFloat(a.annualReturn); if (!isNaN(rr) && v > 0) { _cvS += v; _wrS += rr * v } })
  const portRetSp = _cvS > 0 ? _wrS / _cvS : 0
  const eduCosts = profile?.educationCosts ?? {}
  const eduInf = profile?.educationInflation ?? 5, eduRet = profile?.educationFundReturn ?? 4
  const children: any[] = client?.children ?? []



  // ค่าที่หัวข้อรายงาน (ซึ่งแยกไปเป็นคอมโพเนนต์ในโฟลเดอร์ report/sections) ต้องใช้
  const ctx: ReportCtx = {
    client, advisor, profile, clientName, today, age, hasSpouse, children,
    eduPlan, eduCosts, eduInf, eduRet, retR, retRSp, insR, insRSp, eduR, covSelf, covSp,
    ratios, ratiosSp, sm, taxPlanQ, estatePlanQ, marketData, rebalQ, expensesQ, domainAdvice,
    invProfile, retPlan, allocation, PIE_COLORS, totalInv, portRet, invAssetsSp, totalInvSp, portRetSp,
    title, secs, setText, signatures, setSignatures, setSigning,
    actionItems,
  }

  function autoNode(kind: string) {
    if (kind === 'service') return <ServiceAgreement ctx={ctx} />
    if (kind === 'ack2') return <Acknowledgement />
    if (kind === 'taxfull') return <TaxSection ctx={ctx} />
    if (kind === 'estatefull') return <EstateSection ctx={ctx} />
    if (kind === 'fin_invest' || kind === 'fin_invest_sp') return <InvestmentAnalysis kind={kind} ctx={ctx} />
    if (kind === 'advprofile') return <AdvisorProfile ctx={ctx} />
    if (kind === 'assumptions') return <Assumptions ctx={ctx} />
    if (kind === 'execsum') return <ExecutiveSummary ctx={ctx} />
    if (kind === 'actionplan') return <ActionPlanSummary ctx={ctx} />
    if (kind === 'goals') return <ClientGoals ctx={ctx} />

    if (kind === 'basicinfo') return <BasicInfo ctx={ctx} />
    if (kind === 'exec' || kind === 'exec_spouse') return <CurrentStatus kind={kind} ctx={ctx} />
    if (kind === 'domains' || kind === 'domains_spouse') return <DomainAnalysis kind={kind} ctx={ctx} />
    if (['finance', 'fin_cf2', 'fin_ratio2', 'finance_sp', 'fin_cf2_sp', 'fin_ratio2_sp'].includes(kind)) return <FinancialStatements kind={kind} ctx={ctx} />
    if (kind === 'insurance') return <InsuranceSection ctx={ctx} />
    if (kind === 'education') return <EducationSection ctx={ctx} />
    if (kind === 'retirement') return <RetirementSection ctx={ctx} />
    if (kind === 'portfolio_reco') return <PortfolioReco ctx={ctx} />
    return null
  }

  // ซ่อนหน้า (คู่สมรส) เมื่อลูกค้าไม่มีข้อมูลคู่สมรส
  const visibleSections = SECTIONS.filter(s => !(['domains_spouse', 'exec_spouse', 'finance_sp', 'fin_cf2_sp', 'fin_ratio2_sp', 'fin_invest_sp'].includes(s.k) && !hasSpouse))
  const included = visibleSections.filter(s => secs[s.k]?.include)

  // ── Export PDF เอง (jsPDF + html2canvas) — ชัวร์ทุกอุปกรณ์ โดยเฉพาะ iPad ที่ print เบราว์เซอร์เพี้ยน ──
  const [exporting, setExporting] = useState(false)
  // ตรวจความครบถ้วนของหน้าข้อตกลง (ติ๊ก PDPA + ลายเซ็น 3 จุด) ก่อนพิมพ์/export ฉบับเต็ม
  function checkSigned(): boolean {
    if (mode !== 'full' || !secs.service?.include) return true
    const missing: string[] = []
    if (!signatures.pdpa_consent) missing.push('ติ๊กช่องความยินยอม PDPA')
    if (!signatures.sig_advisor) missing.push('ลายเซ็นผู้ให้บริการ (นักวางแผนการเงิน)')
    if (!signatures.sig_client) missing.push('ลายเซ็นผู้รับบริการ (ลูกค้า)')
    if (!signatures.sig_witness) missing.push('ลายเซ็นพยาน')
    if (missing.length) {
      alert('ยังไม่สามารถ export ได้ — กรุณาดำเนินการในหน้า "ข้อตกลงในการให้บริการ" ให้ครบก่อน:\n\n• ' + missing.join('\n• '))
      return false
    }
    return true
  }
  async function exportPdf() {
    if (!checkSigned()) return
    const paper = document.getElementById('report-paper')
    if (!paper) return
    // pres → จับ .pd-slide (16:9) · full → จับ .rp-page (A4 portrait)
    const isPres = mode === 'pres'
    const els = (Array.from(paper.querySelectorAll(isPres ? '.pd-slide' : '.rp-page')) as HTMLElement[])
      .filter(el => getComputedStyle(el).display !== 'none')   // ข้ามสไลด์ที่ถูกซ่อนจากเมนูเลือกหน้า
    if (!els.length) return
    setExporting(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
      const fmtPage: [number, number] = isPres ? [297, 210] : [210, 297]   // mm (pres = A4 แนวนอน)
      const pdf = new jsPDF({ orientation: isPres ? 'landscape' : 'portrait', unit: 'mm', format: fmtPage })
      // จับที่ "ความกว้างออกแบบ" เสมอ ไม่ผูกกับความกว้างจอ (บน iPad จอแคบ layout จะยุบ/ตัดขอบ)
      // 1123px ≈ A4 แนวนอน · 794px ≈ A4 แนวตั้ง (ที่ ~96dpi)
      const designW = isPres ? 1123 : 794
      const presH = Math.round(designW * 210 / 297)   // ความสูงสไลด์ (อัตราส่วนคงที่)
      const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        const prev = { width: el.style.width, height: el.style.height, maxWidth: el.style.maxWidth, aspectRatio: el.style.aspectRatio, overflow: el.style.overflow }
        // บังคับขนาดออกแบบ → เนื้อหา (2 คอลัมน์/กราฟ/ตาราง) จัดเต็มความกว้างเหมือนบนจอใหญ่
        el.style.maxWidth = 'none'
        el.style.width = designW + 'px'
        if (isPres) { el.style.height = presH + 'px'; el.style.aspectRatio = 'auto' }
        el.style.overflow = 'visible'
        await nextFrame()          // ให้ layout + AutoFit ปรับตามความกว้างใหม่ก่อนจับภาพ
        await new Promise<void>(r => setTimeout(r, 30))
        const capH = isPres ? presH : el.scrollHeight
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          width: designW, height: capH, windowWidth: designW, windowHeight: capH,
          ignoreElements: e => e.classList?.contains('no-print') })
        Object.assign(el.style, prev)
        const img = canvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage(fmtPage, isPres ? 'landscape' : 'portrait')
        // contain-fit: ย่อภาพให้พอดีหน้าโดยคงสัดส่วน + จัดกึ่งกลาง (ไม่ตัด ไม่ยืด)
        const [pw, ph] = fmtPage
        const sc = Math.min(pw / canvas.width, ph / canvas.height)
        const w = canvas.width * sc, h = canvas.height * sc
        pdf.addImage(img, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h)
      }
      pdf.save(`${(title || 'WealthPro').replace(/[\\/:*?"<>|]/g, '')}.pdf`)
    } catch (e) {
      alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่')
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes rp-spin{to{transform:rotate(360deg)}}.rp-spin{animation:rp-spin .9s linear infinite}
        @media print {
          body * { visibility: hidden !important; }
          #report-paper, #report-paper * { visibility: visible !important; }
          #report-paper { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          /* คงสีพื้นหลัง/การ์ด/กราฟตอนพิมพ์ (เบราว์เซอร์ตัด background โดยดีฟอลต์) */
          #report-paper, #report-paper * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          ${mode === 'pres' ? `
            /* A4 แนวนอนเต็มหน้า (297×210mm) · สไลด์เต็มหน้าไม่มีแถบขาว */
            @page { size: A4 landscape; margin: 0; }
            html, body { height: auto !important; }
            #report-paper { gap: 0 !important; }
            .pd-slide {
              width: 297mm !important; height: 210mm !important; max-width: none !important; aspect-ratio: auto !important;
              box-shadow: none !important; border-radius: 0 !important; margin: 0 auto !important;
              page-break-after: always; break-after: page; break-inside: avoid; overflow: hidden !important;
            }
            .pd-slide:last-of-type { page-break-after: auto; break-after: auto; }
            /* กันกฎ touch (pointer:coarse) ที่ iPad ยังใช้ตอนพิมพ์ ไปขยาย input/ปุ่มจนเลย์เอาต์เพี้ยน */
            input, select, textarea { font-size: inherit !important; }
            button, a[role="button"], [role="tab"] { min-height: 0 !important; }
          ` : `
            @page { size: A4 portrait; margin: 16mm; }
            .rp-page { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
          `}
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print">
        <PageHeader icon={FileText} title="รายงานแผนการเงิน (PDF)" subtitle="เลือกรูปแบบ แล้วพิมพ์/บันทึกเป็น PDF"
          right={
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* หุบ/เปิดเมนูเลือกหน้า เพื่อเพิ่มพื้นที่เอกสาร */}
              <button onClick={() => setPanelOpen(o => !o)} title={panelOpen ? 'ซ่อนเมนู เพิ่มพื้นที่เอกสาร' : 'เปิดเมนูเลือกหน้า'}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                {panelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />} {panelOpen ? 'ซ่อนเมนู' : 'เมนู'}
              </button>
              {/* สลับโหมด ฉบับเต็ม / นำเสนอ */}
              <div style={{ display: 'flex', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 3, gap: 3 }}>
                {([['full', 'ฉบับเต็ม', FileStack], ['pres', 'นำเสนอ', Presentation]] as const).map(([m, lbl, Ic]) => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: mode === m ? 'var(--cyan)' : 'transparent', color: mode === m ? '#00201d' : 'var(--text-secondary)' }}>
                    <Ic size={15} /> {lbl}
                  </button>
                ))}
              </div>
              <button onClick={() => setEditMode(e => !e)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: editMode ? 'var(--cyan)' : 'transparent', color: editMode ? '#00201d' : 'var(--text-secondary)', border: `1px solid ${editMode ? 'var(--cyan)' : 'var(--card-border)'}` }}>
                <Pencil size={15} /> {editMode ? 'เสร็จสิ้นการแก้ไข' : (mode === 'pres' ? 'แก้ไขสไลด์' : 'แก้ไขรายงาน')}
              </button>
              {status === 'saving' && <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={14} className="rp-spin" /> กำลังบันทึก...</span>}
              {status === 'saved' && <span style={{ fontSize: 12.5, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> บันทึกแล้ว</span>}
              <button onClick={() => { if (checkSigned()) window.print() }} title="ใช้ระบบพิมพ์ของเบราว์เซอร์ (เหมาะกับเดสก์ท็อป)"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={16} /> พิมพ์
              </button>
              <button onClick={exportPdf} disabled={exporting} title="ดาวน์โหลดเป็นไฟล์ PDF (แนะนำ · ชัวร์ทุกอุปกรณ์ รวมถึง iPad)"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: 'var(--cyan)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}>
                {exporting ? <Loader2 size={16} className="rp-spin" /> : <Download size={16} />} {exporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
              </button>
            </div>
          } />
      </div>

      {mode === 'pres' ? (
      <div style={{ display: 'grid', gridTemplateColumns: (compact || !panelOpen) ? '1fr' : '250px 1fr', gap: 20, alignItems: 'start' }}>
        {/* เมนูเลือกหน้าสไลด์ (เหมือนฉบับเต็ม) */}
        {panelOpen && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }}>
          {DECK_SLIDES.map(sl => (
            <label key={sl.id} style={{ ...ecard, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: pres[sl.id]?.off ? 0.55 : 1 }}>
              <input type="checkbox" checked={!pres[sl.id]?.off}
                onChange={e => setPres(p => ({ ...p, [sl.id]: { ...p[sl.id], off: !e.target.checked } }))} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: pres[sl.id]?.off ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{sl.label}</span>
            </label>
          ))}
        </div>
        )}
        <div style={{ minWidth: 0 }}>
        <PresentationDeck title={title} pres={pres} advisorBio={(secs['advprofile']?.text ?? '') !== '' ? secs['advprofile'].text : undefined}
          onComment={(k, t) => setPres(p => ({ ...p, [k]: { ...p[k], comment: t } }))}
          onToggleHide={k => setPres(p => ({ ...p, [k]: { ...p[k], hidden: !p[k]?.hidden } }))}
          editMode={editMode}
          overlays={overlays}
          onOverlayChange={(id, els) => setOverlays(o => ({ ...o, [id]: els }))}
          customSlides={customSlides}
          thankYouPhoto={thankYouPhoto}
          onThankYouPhoto={setThankYouPhoto}
          onAddSlide={() => setCustomSlides(s => [...s, { id: `cs${Date.now().toString(36)}` }])}
          onDelSlide={id => { setCustomSlides(s => s.filter(x => x.id !== id)); setOverlays(o => { const n = { ...o }; delete n[id]; return n }) }}
          onMoveSlide={(id, dir) => setCustomSlides(s => {
            const i = s.findIndex(x => x.id === id); if (i < 0) return s
            const j = i + dir; if (j < 0 || j >= s.length) return s
            const a = [...s];[a[i], a[j]] = [a[j], a[i]]; return a
          })} />
        </div>
      </div>
      ) : (
      <SlideEditor.Provider value={{ editMode, snap: false, overlays, setEls: (id, els) => setOverlays(o => ({ ...o, [id]: els })), advisorName: advisor?.fullName, advisorPhone: advisor?.phone }}>
      <div style={{ display: 'grid', gridTemplateColumns: (compact || !panelOpen) ? '1fr' : '250px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Editor */}
        {panelOpen && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }}>
          <div style={ecard}>
            <label style={elbl}>ชื่อรายงาน</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={einp} />
          </div>
          {visibleSections.map(s => (
            <div key={s.k} style={ecard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input type="checkbox" checked={secs[s.k]?.include ?? true} onChange={e => setInc(s.k, e.target.checked)} />
                <span style={{ fontSize: 12.5, fontWeight: s.lvl === 1 ? 700 : 500, color: s.lvl === 1 ? 'var(--cyan)' : 'var(--text-secondary)' }}>
                  {s.lvl === 2 ? '— ' : ''}{s.t}
                </span>
              </div>
              {/* ช่องพิมพ์เฉพาะหัวข้อที่ไม่มีเนื้อหาอัตโนมัติ (หัวข้อ auto ใช้กล่องแก้ไขบนหน้ากระดาษ/ปุ่มแก้ไขรายงานแทน) */}
              {!s.auto && s.k !== 'goals' && (
                <textarea value={secs[s.k]?.text ?? ''} onChange={e => setText(s.k, e.target.value)}
                  placeholder="พิมพ์เนื้อหา/ข้อเสนอแนะสำหรับหัวข้อนี้..." rows={3}
                  style={{ ...einp, resize: 'vertical', minHeight: 56 }} />
              )}
            </div>
          ))}
        </div>
        )}

        {/* Paper preview */}
        <div id="report-paper" style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
          {/* Cover — สไตล์มืออาชีพ (โลโก้ · แถบชื่อเรื่อง · แบนเนอร์ · ข้อมูลลูกค้า/ที่ปรึกษา) */}
          <Page pageId="page:cover">
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 950, justifyContent: 'space-between' }}>
              {/* brand row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  <span style={{ color: '#0f172a' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 3, color: '#94a3b8', marginTop: 2 }}>FINANCIAL PLANNING</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase' }}>Confidential Financial Document</div>
                </div>
              </div>
              {/* title */}
              <div style={{ margin: '36px 0 24px' }}>
                <h1 style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', borderLeft: '8px solid #00cfc1', paddingLeft: 22, lineHeight: 1.35, margin: 0 }}>{title}</h1>
                <div style={{ height: 4, width: 120, background: '#00cfc1', opacity: .45, marginTop: 14, marginLeft: 30 }} />
              </div>
              {/* hero band (gradient — print-safe ไม่พึ่งรูปภายนอก) */}
              <div style={{ position: 'relative', width: '100%', height: 300, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #00cfc1 130%)' }}>
                <div style={{ position: 'absolute', right: -70, top: -70, width: 260, height: 260, borderRadius: '50%', background: 'rgba(0,207,193,0.16)' }} />
                <div style={{ position: 'absolute', right: 60, bottom: -90, width: 210, height: 210, borderRadius: '50%', background: 'rgba(254,183,0,0.10)' }} />
                <div style={{ position: 'absolute', left: -40, bottom: -60, width: 190, height: 190, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.10)' }} />
                <div style={{ position: 'absolute', left: 34, bottom: 30 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>HOLISTIC FINANCIAL PLANNING</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 6 }}>แผนการเงินแบบองค์รวม 6 ด้าน</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>สภาพคล่อง · การลงทุน · ประกัน & ความเสี่ยง · เกษียณอายุ · ภาษี · มรดก</div>
                </div>
              </div>
              {/* prepared for / advisor */}
              {/* ข้อมูลลูกค้า — เหนือเส้นคั่น */}
              <div style={{ padding: '24px 0 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>จัดทำเพื่อ</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>คุณ{clientName}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>เอกสารเฉพาะบุคคล · ห้ามเผยแพร่</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', margin: '18px 0 4px' }}>วันที่จัดทำรายงาน</div>
                <div style={{ fontSize: 14, color: '#334155' }}>{today}</div>
              </div>
              {/* ข้อมูลนักวางแผน — ใต้เส้นคั่น ขยับลงล่าง */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, padding: '34px 0 26px', borderTop: '1px solid #f1f5f9' }}>
                <div />
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>นักวางแผนการเงิน</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{advisor?.fullName || 'ที่ปรึกษาการเงิน'}</div>
                    {advisor?.position && <div style={{ fontSize: 12, color: '#475569' }}>{advisor.position}</div>}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{[advisor?.phone, advisor?.email].filter(Boolean).join(' · ')}</div>
                    {advisor?.address && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{advisor.address}</div>}
                  </div>
                  {advisor?.photo
                    ? <img src={advisor.photo} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #00cfc1', flexShrink: 0 }} />
                    : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e2e8f0', flexShrink: 0 }} />}
                </div>
              </div>
              <div style={{ textAlign: 'center', paddingTop: 16, borderTop: '1px solid #f1f5f9', fontSize: 10.5, color: '#94a3b8' }}>
                © {new Date().getFullYear()} WealthPro Financial Planning · Proprietary and Confidential
              </div>
            </div>
          </Page>

          {/* TOC */}
          <Page pageId="page:toc">
            <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#0f2a43', marginBottom: 24 }}>สารบัญ</h2>
            {included.map((s, i) => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0', paddingLeft: s.lvl === 2 ? 28 : 0 }}>
                <span style={{ fontSize: s.lvl === 1 ? 14 : 13, fontWeight: s.lvl === 1 ? 600 : 400, color: s.lvl === 1 ? '#0f2a43' : '#475569' }}>{s.lvl === 1 ? `${i + 1}. ` : ''}{s.t}</span>
                <span style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', margin: '0 4px', transform: 'translateY(-3px)' }} />
              </div>
            ))}
          </Page>

          {/* Content sections */}
          {included.map((s, idx) => (
            <Page key={s.k} pageId={`page:${s.k}`}>
              {/* running header — แบรนด์ + เลขหน้า */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 22 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}><span style={{ color: '#0f172a' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span></span>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, color: '#94a3b8' }}>{title} • หน้า {idx + 3}</span>
              </div>
              <h2 style={{ fontSize: s.lvl === 1 ? 20 : 16, fontWeight: 800, color: '#0f172a', borderLeft: '5px solid #00cfc1', paddingLeft: 12, marginBottom: 16 }}>{s.t}</h2>
              {s.auto && autoNode(s.auto)}
              {!TEXT_HANDLED.has(s.k) && (secs[s.k]?.text || '').split('\n').map((p, i) => (
                <p key={i} style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.8, marginBottom: 8 }}>{p || ' '}</p>
              ))}
            </Page>
          ))}
        </div>
      </div>
      </SlideEditor.Provider>
      )}

      {/* modal ลงนามบนหน้าจอ (ขยายใหญ่ เซ็นด้วยนิ้ว/เมาส์) */}
      {signing && (
        <SignModal
          title={signing === 'sig_advisor' ? 'ลงนาม — ผู้ให้บริการ (นักวางแผนการเงิน)' : signing === 'sig_client' ? 'ลงนาม — ผู้รับบริการ (ลูกค้า)' : 'ลงนาม — พยาน'}
          value={signatures[signing] || ''}
          onSave={v => { setSignatures(s => ({ ...s, [signing]: v })); setSigning(null) }}
          onClear={() => { setSignatures(s => { const n = { ...s }; delete n[signing]; return n }); setSigning(null) }}
          onClose={() => setSigning(null)} />
      )}
    </div>
  )
}

/* ── modal ลายเซ็น: canvas ใหญ่ เซ็นบนหน้าจอ/ทัชสกรีนได้ ── */
function SignModal({ title, value, onSave, onClear, onClose }: { title: string; value: string; onSave: (v: string) => void; onClear: () => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = value }
  }, [])
  const pos = (e: any) => {
    const c = ref.current!, r = c.getBoundingClientRect(), t = e.touches?.[0]
    // แปลงพิกัดจอ → พิกัด canvas จริง (กัน canvas ถูกย่อบนจอเล็กแล้วเส้นเพี้ยน)
    const sx = c.width / r.width, sy = c.height / r.height
    return { x: ((t ? t.clientX : e.clientX) - r.left) * sx, y: ((t ? t.clientY : e.clientY) - r.top) * sy }
  }
  const start = (e: any) => { drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const move = (e: any) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#0f2a43'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); dirty.current = true }
  const end = () => { drawing.current = false }
  const clearCanvas = () => { const c = ref.current!; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); dirty.current = true }
  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px', width: '100%', maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>เซ็นในกรอบสีขาวด้วยเมาส์หรือนิ้ว (ทัชสกรีน) แล้วกด "บันทึกลายเซ็น"</div>
        <canvas ref={ref} width={660} height={240}
          style={{ width: '100%', background: '#fff', borderRadius: 10, border: '1px solid var(--card-border)', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={clearCanvas} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>ล้างกระดาน</button>
          <button onClick={onClear} style={{ padding: '8px 16px', background: 'none', border: '1px solid #ef4444', borderRadius: 9, color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>ลบลายเซ็นที่บันทึกไว้</button>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>ปิด</button>
          <button onClick={() => onSave(ref.current!.toDataURL('image/png'))} style={{ padding: '8px 20px', background: 'var(--cyan)', border: 'none', borderRadius: 9, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>บันทึกลายเซ็น</button>
        </div>
      </div>
    </div>
  )
}

function Page({ children, pageId }: { children: React.ReactNode; pageId?: string }) {
  return (
    <div className="rp-page" style={{ width: '100%', maxWidth: 794, minHeight: 1050, background: '#ffffff', color: '#1e293b', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', borderRadius: 4, padding: '48px 56px', fontFamily: "'Sarabun', sans-serif", position: 'relative' }}>
      {children}
      {pageId && <OverlayLayer slideId={pageId} />}
    </div>
  )
}


const ecard: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px' }
const elbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }
const einp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
