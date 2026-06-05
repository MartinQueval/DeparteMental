import { useState } from 'react'
import franceMap from '@svg-maps/france.departments'
import { byCode, shuffle } from '../lib/departements.ts'
import { recordAnswer, load, type DeptStats } from '../lib/storage.ts'

const ROUNDS = 10
const mapCodes = franceMap.locations.map((l) => l.id)

type CarteMode = 'jeu' | 'heatmap'
type CellResult = 'ok' | 'ko' | 'target'

function heatColor(code: string, stats: Record<string, DeptStats>): string {
  const s = stats[code]
  if (!s) return '#2d3250'
  const rate = s.ok / s.seen
  if (rate >= 0.8) return '#22c55e'
  if (rate >= 0.5) return '#eab308'
  return '#ef4444'
}

export default function Carte() {
  const [mode, setMode] = useState<CarteMode | null>(null)
  const [queue, setQueue] = useState<string[]>([])
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<Record<string, CellResult>>({})
  const [locked, setLocked] = useState(false)
  const stats = load().stats

  function start() {
    setQueue(shuffle(mapCodes).slice(0, ROUNDS))
    setRound(0)
    setScore(0)
    setResult({})
    setLocked(false)
    setMode('jeu')
  }

  const targetCode = queue[round]
  const target = targetCode ? byCode[targetCode] : null

  function clickDept(id: string) {
    if (mode !== 'jeu' || locked || round >= ROUNDS) return
    const ok = id === targetCode
    recordAnswer(targetCode, ok)
    if (ok) {
      setScore((s) => s + 1)
      setResult((r) => ({ ...r, [id]: 'ok' }))
      setTimeout(() => setRound((r) => r + 1), 400)
    } else {
      setLocked(true)
      setResult((r) => ({ ...r, [id]: 'ko', [targetCode]: 'target' }))
      setTimeout(() => {
        setResult((r) => {
          const rest = { ...r }
          delete rest[id]
          delete rest[targetCode]
          return rest
        })
        setLocked(false)
        setRound((r) => r + 1)
      }, 1400)
    }
  }

  if (!mode) {
    return (
      <div className="carte setup">
        <h2>🗺️ Carte de France</h2>
        <div className="setup-buttons">
          <button className="btn-primary" onClick={start}>
            Jouer ({ROUNDS} départements à localiser)
          </button>
          <button className="btn-primary" onClick={() => setMode('heatmap')}>
            Ma heatmap de progression
          </button>
        </div>
      </div>
    )
  }

  const finished = mode === 'jeu' && round >= ROUNDS

  return (
    <div className="carte">
      {mode === 'jeu' && !finished && target && (
        <div className="hud">
          <span>🎯 {round + 1}/{ROUNDS}</span>
          <span className="carte-target">
            Clique sur : <strong>{target.nom} ({target.code})</strong>
          </span>
          <span className="score">{score} ✅</span>
        </div>
      )}
      {finished && (
        <div className="carte-done">
          <p className="final-score">{score} / {ROUNDS} 🎯</p>
          <button className="btn-primary" onClick={start}>Rejouer</button>
        </div>
      )}
      {mode === 'heatmap' && (
        <p className="hint">
          🟢 maîtrisé · 🟡 moyen · 🔴 à bosser · gris : jamais croisé
        </p>
      )}

      <svg
        viewBox={franceMap.viewBox}
        className="france-map"
        role="img"
        aria-label="Carte des départements français"
      >
        {franceMap.locations.map((loc) => {
          const r = result[loc.id]
          const fill =
            mode === 'heatmap'
              ? heatColor(loc.id, stats)
              : r === 'ok'
                ? '#22c55e'
                : r === 'ko'
                  ? '#ef4444'
                  : r === 'target'
                    ? '#3b82f6'
                    : '#2d3250'
          return (
            <path
              key={loc.id}
              d={loc.path}
              fill={fill}
              className="dept-path"
              onClick={() => clickDept(loc.id)}
            >
              <title>{mode === 'heatmap' ? `${byCode[loc.id].nom} (${loc.id})` : ''}</title>
            </path>
          )
        })}
      </svg>
    </div>
  )
}
