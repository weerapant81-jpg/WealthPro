import InvestmentMonteCarloChart from '../../components/InvestmentMonteCarloChart'
import InsuranceCoverageSummary from '../../components/InsuranceCoverageSummary'
import { TrendingUp, ShieldCheck } from 'lucide-react'

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 18 }
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 15, fontWeight: 800 }

/* แผนของฉัน — มุมมองอ่านอย่างเดียว reuse กราฟจากฝั่ง FA (คอมโพเนนต์ดึงข้อมูลเองตาม effectiveUserId = ตัวลูกค้า) */
export default function PortalPlan() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>แผนของฉัน</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>ภาพจำลองการเงินระยะยาวที่นักวางแผนจัดทำให้</div>
      </div>

      <div style={card}>
        <div style={head}><TrendingUp size={18} color="var(--cyan)" /> มูลค่าสินทรัพย์ลงทุน (จำลองอนาคต)</div>
        <InvestmentMonteCarloChart person="self" height={260} />
      </div>

      <div style={card}>
        <div style={head}><ShieldCheck size={18} color="var(--cyan)" /> ความคุ้มครองประกัน</div>
        <InsuranceCoverageSummary person="self" />
      </div>
    </div>
  )
}
