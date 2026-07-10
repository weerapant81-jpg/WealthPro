import React, { useState, useMemo, useEffect } from 'react'
import { card, inp } from '../styles/dark'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ChartFrame, TableExcelButton } from '../components/exportable'
import { TrendingUp, Info, Star, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  type Asset, type WeightsMatrix, type PortfolioSet,
  DEFAULT_ASSETS, DEFAULT_CORR, PORTFOLIO_SETS,
  computePortfolio, initAllWeights, applyCorrelation, applyMarketData,
} from '../lib/portfolioReturns'

// ─── Local constants ──────────────────────────────────────────────────────────

const ASSET_LABELS = ['ตราสารหนี้ระยะกลาง', 'หุ้นไทย (SET TRI)', 'หุ้นโลก (MSCI ACWI)', 'หุ้นสหรัฐฯ (S&P 500)']
const PIE_COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#f43f5e']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt2(n: number) { return n.toFixed(2) }

// ─── Correlation Cell ─────────────────────────────────────────────────────────

function CorrCell({ val, editable, onChange }: { val: number; editable: boolean; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const color = val > 0.5 ? '#f59e0b' : val < -0.3 ? '#22d3ee' : 'var(--text-secondary)'

  if (!editable) return (
    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, color, fontWeight: 600 }}>
      {fmt2(val)}
    </td>
  )
  return (
    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { const v = parseFloat(draft); if (!isNaN(v)) onChange(Math.max(-1, Math.min(1, v))); setEditing(false) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{ ...inp, width: 64, textAlign: 'center', fontSize: 12, padding: '4px 6px' }}
        />
      ) : (
        <span
          onClick={() => { setDraft(String(val)); setEditing(true) }}
          style={{ cursor: 'pointer', color, fontWeight: 600, fontSize: 13, padding: '4px 8px', display: 'inline-block',
            borderRadius: 4, border: '1px solid transparent', transition: 'border 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
        >
          {fmt2(val)}
        </span>
      )}
    </td>
  )
}

// ─── Allocation Pie ────────────────────────────────────────────────────────────

function AllocationPie({ weights }: { weights: [number,number,number,number] }) {
  const cx = 80, cy = 80, R = 58, r = 36
  const gap = 2 // px gap between slices (degrees)

  // build slices
  type Slice = { color: string; startDeg: number; endDeg: number; pct: number; label: string }
  const slices: Slice[] = []
  let cursor = -90 // start from top
  const total = weights.reduce((s, w) => s + w, 0)
  weights.forEach((w, i) => {
    if (w <= 0) return
    const deg = (w / total) * 360
    slices.push({ color: PIE_COLORS[i], startDeg: cursor, endDeg: cursor + deg, pct: w, label: ASSET_LABELS[i] })
    cursor += deg
  })

  function polarToXY(deg: number, rad: number) {
    const angle = (deg * Math.PI) / 180
    return { x: cx + rad * Math.cos(angle), y: cy + rad * Math.sin(angle) }
  }

  function arcPath(startDeg: number, endDeg: number) {
    const gapDeg = (gap / (2 * Math.PI * R)) * 360 * 0.5
    const s = startDeg + gapDeg, e = endDeg - gapDeg
    const large = e - s > 180 ? 1 : 0
    const o1 = polarToXY(s, R), o2 = polarToXY(e, R)
    const i1 = polarToXY(e, r), i2 = polarToXY(s, r)
    return `M${o1.x},${o1.y} A${R},${R},0,${large},1,${o2.x},${o2.y} L${i1.x},${i1.y} A${r},${r},0,${large},0,${i2.x},${i2.y} Z`
  }

  const [hovered, setHovered] = React.useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {slices.map((s, i) => (
          <path
            key={i}
            d={arcPath(s.startDeg, s.endDeg)}
            fill={s.color}
            opacity={hovered === null || hovered === i ? 1 : 0.35}
            style={{ cursor: 'default', transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {/* center label */}
        {hovered !== null ? (
          <>
            <text x={cx} y={cy - 7} textAnchor="middle" fill={slices[hovered]?.color ?? '#fff'} fontSize={15} fontWeight={700}>{slices[hovered]?.pct}%</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={8}>{slices[hovered]?.label.split(' ')[0]}</text>
          </>
        ) : (
          <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10}>สัดส่วน</text>
        )}
      </svg>
      {/* legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', justifyContent: 'center' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.label.split(' ')[0].replace('(', '')}</span>
            <span style={{ fontSize: 9, color: s.color, fontWeight: 600 }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Weight Input ──────────────────────────────────────────────────────────────

function WeightInput({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // sync when parent changes (e.g. reset)
  React.useEffect(() => { if (!focused) setDraft(String(value)) }, [value, focused])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <input
        value={draft}
        onFocus={() => { setFocused(true); setDraft(String(value)) }}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false)
          const v = parseFloat(draft)
          if (!isNaN(v) && v >= 0 && v <= 100) onChange(v)
          else setDraft(String(value))
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{ ...inp, width: 46, textAlign: 'center', fontSize: 12, padding: '3px 4px',
          color, fontWeight: 700, border: `1px solid ${color}40`, background: `${color}08` }}
      />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
    </div>
  )
}

// ─── Portfolio Card ────────────────────────────────────────────────────────────

function PortfolioSetCard({
  set, assets, corr, weights, onWeightsChange,
}: {
  set: PortfolioSet
  assets: Asset[]
  corr: number[][]
  weights: WeightsMatrix
  onWeightsChange: (optIdx: number, assetIdx: number, val: number) => void
}) {
  const results = weights.map(w => computePortfolio(w, assets, corr))
  const bestIdx = results.reduce((bi, r, i) => r.sharpe > results[bi].sharpe ? i : bi, 0)

  // per-option sum warning
  const sums = weights.map(w => w.reduce((s, v) => s + v, 0))

  return (
    <div style={{ ...card }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${set.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={18} color={set.color} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: set.color }}>{set.label}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{set.sub}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: `${set.color}14`, borderRadius: 8, padding: '4px 10px', border: `1px solid ${set.color}30` }}>
          <Star size={11} color={set.color} fill={set.color} />
          <span style={{ fontSize: 11, color: set.color, fontWeight: 600 }}>แนะนำ: {set.options[bestIdx].label}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
        {set.options.map((opt, i) => {
          const r = results[i]
          const isBest = i === bestIdx
          const sum = sums[i]
          const sumOk = Math.abs(sum - 100) < 0.01
          return (
            <div key={i} style={{
              background: isBest ? `${set.color}10` : 'var(--hover)',
              border: `1.5px solid ${isBest ? set.color : 'var(--card-border)'}`,
              borderRadius: 12, padding: 14, position: 'relative',
            }}>
              {isBest && (
                <div style={{ position: 'absolute', top: -10, right: 12, background: set.color, borderRadius: 20,
                  padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={10} color="#fff" fill="#fff" />
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>Best Sharpe</span>
                </div>
              )}

              <p style={{ fontSize: 12, fontWeight: 600, color: isBest ? set.color : 'var(--text-secondary)', marginBottom: 10 }}>{opt.label}</p>

              {/* Editable allocation rows */}
              <div style={{ marginBottom: 4 }}>
                {ASSET_LABELS.map((name, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: PIE_COLORS[j], flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.split(' ')[0]}</span>
                    <WeightInput
                      value={weights[i][j]}
                      onChange={v => onWeightsChange(i, j, v)}
                      color={PIE_COLORS[j]}
                    />
                  </div>
                ))}
              </div>

              {/* Sum indicator */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: sumOk ? 'rgba(16,185,129,0.12)' : 'rgba(251,113,133,0.12)',
                  color: sumOk ? '#10b981' : '#fb7185',
                  border: `1px solid ${sumOk ? '#10b98130' : '#fb718530'}`,
                }}>
                  รวม: {fmt2(sum)}% {sumOk ? '✓' : '⚠'}
                </span>
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 6, paddingTop: 10, borderTop: '1px solid var(--card-border)', opacity: sumOk ? 1 : 0.4 }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>ผลตอบแทนคาดหวัง</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>+{fmt2(r.ret)}%</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>ความเสี่ยง (σ)</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: set.color }}>{fmt2(r.sigma)}%</p>
                </div>
                <div style={{ textAlign: 'center', gridColumn: '1/-1', paddingTop: 6, borderTop: '1px solid var(--card-border)' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Sharpe Ratio (E(Rp)/σ)</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: isBest ? set.color : 'var(--text-primary)' }}>{fmt2(r.sharpe)}</p>
                </div>
              </div>

              {/* Pie */}
              <AllocationPie weights={weights[i]} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Efficient Frontier Scatter ───────────────────────────────────────────────

function EfficientFrontierChart({ assets, corr, allWeights }: { assets: Asset[]; corr: number[][]; allWeights: WeightsMatrix[] }) {
  const points: { x: number; y: number; label: string; color: string; isBest: boolean; setLabel: string }[] = []

  PORTFOLIO_SETS.forEach((set, si) => {
    const results = allWeights[si].map(w => computePortfolio(w, assets, corr))
    const bestIdx = results.reduce((bi, r, i) => r.sharpe > results[bi].sharpe ? i : bi, 0)
    results.forEach((r, i) => {
      points.push({ x: parseFloat(fmt2(r.sigma)), y: parseFloat(fmt2(r.ret)), label: `${set.label} ${set.options[i].label}`, color: set.color, isBest: i === bestIdx, setLabel: set.label })
    })
  })

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    if (!cx || !cy) return null
    return (
      <g>
        <circle cx={cx} cy={cy} r={payload.isBest ? 8 : 5} fill={payload.color} opacity={payload.isBest ? 1 : 0.45} stroke={payload.isBest ? '#fff' : 'none'} strokeWidth={1.5} />
        {payload.isBest && <circle cx={cx} cy={cy} r={12} fill="none" stroke={payload.color} strokeWidth={1} opacity={0.4} />}
      </g>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload
    return (
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
        <p style={{ color: d.color, fontWeight: 700, marginBottom: 6 }}>{d.label}</p>
        <p style={{ color: '#10b981' }}>ผลตอบแทน: +{d.y}%</p>
        <p style={{ color: d.color }}>ความเสี่ยง (σ): {d.x}%</p>
        {d.isBest && <p style={{ color: '#fbbf24', marginTop: 4 }}>⭐ Best Sharpe</p>}
      </div>
    )
  }

  return (
    <div style={{ ...card }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Efficient Frontier</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>ผลตอบแทนคาดหวัง vs ความเสี่ยง — จุดที่ไฮไลท์คือพอร์ตแนะนำ (Sharpe สูงสุด)</p>
      </div>
      <ChartFrame title="Efficient Frontier" filename="efficient-frontier" height={320}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" />
          <XAxis dataKey="x" name="ความเสี่ยง (σ)" unit="%" type="number" domain={['auto','auto']}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }} label={{ value: 'ความเสี่ยง σ (%)', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }} />
          <YAxis dataKey="y" name="ผลตอบแทน" unit="%" type="number" domain={['auto','auto']}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }} label={{ value: 'ผลตอบแทน E(Rp) (%)', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--text-muted)', fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={points} shape={<CustomDot />} />
        </ScatterChart>
      </ResponsiveContainer>
      </ChartFrame>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {PORTFOLIO_SETS.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
            {s.label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'transparent', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
          </div>
          พอร์ตแนะนำ
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestmentAssumptionPage() {
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS)
  const [corr, setCorr] = useState<number[][]>(DEFAULT_CORR)
  const [corrLive, setCorrLive] = useState(false)
  const [corrSampleMonths, setCorrSampleMonths] = useState(0)
  const [allWeights, setAllWeights] = useState<WeightsMatrix[]>(initAllWeights)
  const [marketApplied, setMarketApplied] = useState(false)

  // fetch market data
  const { data: marketData, isFetching, isError } = useQuery({
    queryKey: ['market-data'],
    queryFn: () => api.get('/market-data').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // refresh mutation (bust cache on server)
  const refreshMut = useMutation({
    mutationFn: () => api.post('/market-data/refresh').then(r => r.data),
    onSuccess: (data) => {
      setAssets(applyMarketData(DEFAULT_ASSETS, data))
      const corrResult = applyCorrelation(DEFAULT_CORR, data)
      setCorr(corrResult.matrix)
      setCorrLive(corrResult.live)
      setCorrSampleMonths(corrResult.sampleMonths)
      setMarketApplied(true)
    },
  })

  // apply market data once loaded
  useEffect(() => {
    if (marketData && !marketApplied) {
      setAssets(applyMarketData(DEFAULT_ASSETS, marketData))
      const corrResult = applyCorrelation(DEFAULT_CORR, marketData)
      setCorr(corrResult.matrix)
      setCorrLive(corrResult.live)
      setCorrSampleMonths(corrResult.sampleMonths)
      setMarketApplied(true)
    }
  }, [marketData, marketApplied])

  const setAssetField = (id: string, field: 'cagr' | 'sd', val: number) => {
    setAssets(a => a.map(x => x.id === id ? { ...x, [field]: val } : x))
  }

  const setCorrelation = (i: number, j: number, val: number) => {
    setCorr(c => {
      const next = c.map(row => [...row])
      next[i][j] = val
      next[j][i] = val
      return next
    })
  }

  const handleWeightChange = (setIdx: number, optIdx: number, assetIdx: number, val: number) => {
    setAllWeights(prev => {
      const next = prev.map(m => m.map(w => [...w] as [number,number,number,number]))
      next[setIdx][optIdx][assetIdx] = val
      return next
    })
  }

  const handleRefresh = () => {
    setMarketApplied(false)
    refreshMut.mutate()
  }

  const portAssets = assets.filter(a => a.inPortfolio)
  const fetchedAt = marketData?.fetchedAt ? new Date(marketData.fetchedAt) : null
  const isRefreshing = isFetching || refreshMut.isPending

  // Summary of best recommendations
  const bestSummary = useMemo(() => PORTFOLIO_SETS.map((set, si) => {
    const results = allWeights[si].map(w => computePortfolio(w, assets, corr))
    const bestIdx = results.reduce((bi, r, i) => r.sharpe > results[bi].sharpe ? i : bi, 0)
    return { ...set, bestWeights: allWeights[si][bestIdx], result: results[bestIdx] }
  }), [assets, corr, allWeights])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>สมมติฐานการลงทุน</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            วิเคราะห์พอร์ตการลงทุนที่เหมาะสม 3 ระดับความเสี่ยง โดยใช้ข้อมูลผลตอบแทนและความผันผวนย้อนหลัง 10 ปี
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--card-border)',
              background: isRefreshing ? 'var(--divider)' : 'rgba(14,165,233,0.1)', cursor: isRefreshing ? 'not-allowed' : 'pointer',
              color: '#7dd3fc', fontSize: 12, fontWeight: 600, transition: 'background 0.15s',
            }}
          >
            <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            {isRefreshing ? 'กำลังโหลด...' : 'อัปเดตข้อมูล'}
          </button>
          {fetchedAt && (
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              อัปเดตล่าสุด: {fetchedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {isError && !isRefreshing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#fb7185' }}>
              <WifiOff size={11} /> ไม่สามารถเชื่อมต่อได้ ใช้ค่าอ้างอิง
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Summary banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 16 }}>
        {bestSummary.map(s => (
          <div key={s.id} style={{ ...card, padding: '16px 20px', borderColor: `${s.color}40` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Star size={13} color={s.color} fill={s.color} />
              <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              {ASSET_LABELS.map((name, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i], margin: '0 auto 3px' }} />
                  <p style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 1 }}>{name.split(' ')[0]}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: PIE_COLORS[i] }}>{s.bestWeights[i]}%</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>E(Rp)</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>+{fmt2(s.result.ret)}%</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>σ</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{fmt2(s.result.sigma)}%</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>Sharpe</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt2(s.result.sharpe)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20 }}>

        {/* Section 1: Asset Assumptions */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--card-border)' }}>
            <TrendingUp size={16} color="var(--cyan)" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>สมมติฐานผลตอบแทนและความเสี่ยง</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>ย้อนหลัง 10 ปี (2016–2026) — คลิกตัวเลขเพื่อแก้ไข</p>
            </div>
            <span style={{ marginLeft: 'auto' }}><TableExcelButton filename="สมมติฐานผลตอบแทน" title="สมมติฐาน" /></span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['ประเภทสินทรัพย์', 'CAGR (%)', 'SD (%)', 'แหล่งข้อมูล'].map(h => (
                  <th key={h} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '6px 10px', textAlign: h === 'ประเภทสินทรัพย์' ? 'left' : 'center', borderBottom: '1px solid var(--card-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map(a => {
                const dotColor = a.inPortfolio ? PIE_COLORS[portAssets.findIndex(p => p.id === a.id)] ?? '#888' : '#555'
                const isLive = a.live === true
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        <span>{a.name}</span>
                        {isLive && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700,
                            color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                            padding: '1px 6px', borderRadius: 20 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                            LIVE
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                      <EditableNum value={a.cagr} onChange={v => setAssetField(a.id, 'cagr', v)} color="#10b981" suffix="%" />
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                      {a.id === 'deposit'
                        ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        : <EditableNum value={a.sd} onChange={v => setAssetField(a.id, 'sd', v)} color="#f59e0b" suffix="%" />}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {isLive
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#10b981' }}><Wifi size={9}/> {a.note}</span>
                          : <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)' }}><WifiOff size={9}/> {a.note ?? 'ค่าอ้างอิง'}</span>}
                        {a.asOf && a.asOf !== 'ข้อมูลอ้างอิง' && (
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>ณ {a.asOf}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
          <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(14,165,233,0.06)', borderRadius: 8, display: 'flex', gap: 6 }}>
            <Info size={12} color="#7dd3fc" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: '#7dd3fc', lineHeight: 1.6 }}>
              เงินฝากประจำ (SD=0%) ไม่ถูกนำมาคำนวณพอร์ต เนื่องจากไม่มีความผันผวน ใช้เป็นแหล่งอ้างอิงเท่านั้น
            </p>
          </div>
        </div>

        {/* Section 2: Correlation Matrix */}
        <div style={card}>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>ค่าสัมประสิทธิ์สหสัมพันธ์ (Correlation)</p>
              {corrLive
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 20 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    LIVE · {corrSampleMonths} เดือน
                  </span>
                : <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--grid)', padding: '2px 8px', borderRadius: 20 }}>ค่าอ้างอิง</span>}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>คำนวณจาก monthly returns ย้อนหลัง 10 ปี — คลิกตัวเลขเพื่อแก้ไข</p>
            {corrLive && <p style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>⚠ ตราสารหนี้ใช้ AGG ETF เป็น proxy เนื่องจาก ThaiBMA ไม่มี free API</p>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <TableExcelButton filename="เมทริกซ์สหสัมพันธ์" title="Correlation" />
            </div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 10, color: 'var(--text-muted)', padding: '6px 8px', textAlign: 'left' }}></th>
                  {ASSET_LABELS.map((l, i) => (
                    <th key={i} style={{ fontSize: 10, color: PIE_COLORS[i], fontWeight: 600, padding: '6px 8px', textAlign: 'center', maxWidth: 80 }}>
                      {l.split(' ')[0].replace('(', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSET_LABELS.map((rowLabel, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ fontSize: 11, color: PIE_COLORS[i], fontWeight: 600, padding: '8px', whiteSpace: 'nowrap' }}>
                      {rowLabel.split(' ')[0].replace('(', '')}
                    </td>
                    {ASSET_LABELS.map((_, j) => {
                      if (j > i) return <td key={j} style={{ padding: '8px 12px', textAlign: 'center' }}><span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 13 }}>—</span></td>
                      if (j === i) return <td key={j} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>1.00</td>
                      return <CorrCell key={j} val={corr[i][j]} editable onChange={v => setCorrelation(i, j, v)} />
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 3, background: '#f59e0b', borderRadius: 2 }} />
              สหสัมพันธ์ทางบวกสูง (&gt;0.5)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 3, background: '#22d3ee', borderRadius: 2 }} />
              สหสัมพันธ์ทางลบ (&lt;-0.3)
            </div>
          </div>
        </div>
      </div>

      {/* Efficient Frontier */}
      <EfficientFrontierChart assets={assets} corr={corr} allWeights={allWeights} />

      {/* Portfolio Cards */}
      {PORTFOLIO_SETS.map((set, si) => (
        <PortfolioSetCard key={set.id} set={set} assets={assets} corr={corr}
          weights={allWeights[si]}
          onWeightsChange={(optIdx, assetIdx, val) => handleWeightChange(si, optIdx, assetIdx, val)}
        />
      ))}

      {/* Source note */}
      <div style={{ ...card, padding: '14px 18px', background: 'var(--hover)' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>แหล่งที่มาของข้อมูล</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 4, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div>• ThaiBMA — ดัชนีพันธบัตรรัฐบาลและหนี้เอกชน</div>
          <div>• SET (ตลาดหลักทรัพย์ไทย) — SET TRI Total Return Index</div>
          <div>• S&P Dow Jones Indices — S&P 500 Total Return</div>
          <div>• Bloomberg / Investing.com — MSCI ACWI ย้อนหลัง 10 ปี</div>
          <div>• ธนาคารแห่งประเทศไทย (BOT) — อัตราดอกเบี้ยเงินฝาก</div>
          <div>• การคำนวณ: CAGR, SD จากข้อมูลรายเดือน ปี 2016–2026</div>
        </div>
      </div>
    </div>
  )
}

// ─── Editable Number Cell ─────────────────────────────────────────────────────

function EditableNum({ value, onChange, color, suffix }: { value: number; onChange: (v: number) => void; color: string; suffix?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { const v = parseFloat(draft); if (!isNaN(v) && v >= 0) onChange(v); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      style={{ ...inp, width: 70, textAlign: 'center', fontSize: 12, padding: '4px 6px' }}
    />
  )
  return (
    <span
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      style={{ cursor: 'pointer', color, fontWeight: 700, fontSize: 13, padding: '3px 8px', display: 'inline-block',
        borderRadius: 4, border: '1px solid transparent', transition: 'border 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
    >
      {value.toFixed(2)}{suffix}
    </span>
  )
}
