import { useCallback, useEffect, useState } from 'react'
import { appearKeyframes } from '../../components/ui'
import { createGame, TOTAL_YEARS } from '../../lib/game/engine'
import { newSeed } from '../../lib/game/rng'
import type { CareerId, DecisionLog, GameState } from '../../lib/game/types'
import IntroScreen from './IntroScreen'
import PlayScreen from './PlayScreen'
import SummaryScreen from './SummaryScreen'

/* ── เกมเศรษฐี — หน้า public (ไม่ต้อง login, ไม่มี sidebar) ──
   intro (เลือกอาชีพ) → play (30 ปี) → summary (ผล + lead form)      */

const SAVE_KEY = 'wp_game_v1'

interface SaveBlob { state: GameState; log: DecisionLog }

function loadSave(): SaveBlob | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as SaveBlob
    return b?.state?.history && b.state.year < TOTAL_YEARS && b.log ? b : null
  } catch { return null }
}

export default function GamePage() {
  const [screen, setScreen] = useState<'intro' | 'play' | 'summary'>('intro')
  const [blob, setBlob] = useState<SaveBlob | null>(null)
  const [saved, setSaved] = useState<SaveBlob | null>(loadSave)

  useEffect(() => {
    const prev = document.title
    document.title = 'เกมเศรษฐี — WealthPro'
    return () => { document.title = prev }
  }, [])

  const start = (careerId: CareerId) => {
    const state = createGame(newSeed(), careerId)
    setBlob({ state, log: { careerId, plans: [], eventChoices: {}, checkpointChoices: {} } })
    setScreen('play')
  }

  const resume = () => { if (saved) { setBlob(saved); setScreen('play') } }

  const persist = useCallback((state: GameState, log: DecisionLog) => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, log })) } catch { /* storage เต็ม/ปิด — เล่นต่อได้ */ }
  }, [])

  const finish = useCallback((state: GameState, log: DecisionLog) => {
    setBlob({ state, log })
    setScreen('summary')
    try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
  }, [])

  const replay = () => { setBlob(null); setSaved(null); setScreen('intro') }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <style>{appearKeyframes}</style>
      <div style={{
        maxWidth: 560, margin: '0 auto', padding: '18px 16px 30px',
        minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: screen === 'intro' ? 'center' : 'flex-start',
      }}>
        {screen === 'intro' && <IntroScreen onStart={start} onResume={resume} hasSave={!!saved} />}
        {screen === 'play' && blob && (
          <PlayScreen key={blob.state.seed} initState={blob.state} initLog={blob.log} onPersist={persist} onFinish={finish} />
        )}
        {screen === 'summary' && blob && <SummaryScreen state={blob.state} log={blob.log} onReplay={replay} />}
      </div>
    </div>
  )
}
