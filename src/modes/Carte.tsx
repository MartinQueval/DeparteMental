import { useEffect, useRef, useState } from 'react'
import franceMap from '@svg-maps/france.departments'
import { byCode, shuffle } from '../lib/departements.ts'
import { recordAnswer, load, type DeptStats } from '../lib/storage.ts'
import { sfx } from '../lib/sound.ts'
import { IconCheck, IconDot, IconMap, IconTarget } from '../components/icons.tsx'

const ROUNDS = 10
const mapCodes = franceMap.locations.map((l) => l.id)
const IDF_CODES = ['75', '92', '93', '94', '91', '95', '77', '78']

type CarteMode = 'jeu' | 'heatmap'
type CellResult = 'ok' | 'ko' | 'target'

interface VB {
  x: number
  y: number
  w: number
  h: number
}

function parseVB(s: string): VB {
  const [x, y, w, h] = s.split(/\s+/).map(Number)
  return { x, y, w, h }
}

const BASE = parseVB(franceMap.viewBox)
const ASPECT = BASE.w / BASE.h
const MIN_W = BASE.w / 9 // zoom max ≈ ×9
const TAP_TOLERANCE = 6 // px : au-delà, c'est un déplacement, pas un clic

function heatColor(code: string, stats: Record<string, DeptStats>): string {
  const s = stats[code]
  if (!s) return '#ffffff'
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
  const [vb, setVb] = useState<VB>(BASE)
  const stats = load().stats

  const svgRef = useRef<SVGSVGElement>(null)
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({})
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map())
  const panRef = useRef<{ cx: number; cy: number; vb: VB } | null>(null)
  const pinchRef = useRef<{ dist: number; sx: number; sy: number; vb: VB } | null>(null)
  const movedRef = useRef(false)

  function start() {
    sfx.start()
    setQueue(shuffle(mapCodes).slice(0, ROUNDS))
    setRound(0)
    setScore(0)
    setResult({})
    setLocked(false)
    setVb(BASE)
    setMode('jeu')
  }

  const targetCode = queue[round]
  const target = targetCode ? byCode[targetCode] : null

  function clickDept(id: string) {
    if (movedRef.current) return // c'était un glissement, pas un clic
    if (mode !== 'jeu' || locked || round >= ROUNDS) return
    const ok = id === targetCode
    const last = round + 1 >= ROUNDS
    recordAnswer(targetCode, ok)
    if (ok) {
      sfx.correct()
      setScore((s) => s + 1)
      setResult((r) => ({ ...r, [id]: 'ok' }))
      setTimeout(() => {
        setRound((r) => r + 1)
        if (last) sfx.finish()
      }, 400)
    } else {
      sfx.wrong()
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
        if (last) sfx.finish()
      }, 1400)
    }
  }

  // ---------- Zoom / déplacement ----------
  function clamp(v: VB): VB {
    const w = Math.min(Math.max(v.w, MIN_W), BASE.w)
    const h = w / ASPECT
    const x = Math.min(Math.max(v.x, BASE.x), BASE.x + BASE.w - w)
    const y = Math.min(Math.max(v.y, BASE.y), BASE.y + BASE.h - h)
    return { x, y, w, h }
  }

  function zoomAround(factor: number, clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return
    setVb((prev) => {
      const rect = svg.getBoundingClientRect()
      const fx = (clientX - rect.left) / rect.width
      const fy = (clientY - rect.top) / rect.height
      const sx = prev.x + fx * prev.w
      const sy = prev.y + fy * prev.h
      const w = prev.w * factor
      const h = w / ASPECT
      return clamp({ x: sx - fx * w, y: sy - fy * h, w, h })
    })
  }

  function zoomButton(factor: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    zoomAround(factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  function zoomIDF() {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const code of IDF_CODES) {
      const el = pathRefs.current[code]
      if (!el) continue
      const b = el.getBBox()
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width)
      maxY = Math.max(maxY, b.y + b.height)
    }
    if (minX === Infinity) return
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const bw = maxX - minX
    const bh = maxY - minY
    let w = Math.max(bw, bh * ASPECT) * 1.25 // marge autour
    w = Math.max(w, MIN_W)
    const h = w / ASPECT
    setVb(clamp({ x: cx - w / 2, y: cy - h / 2, w, h }))
  }

  function startPan(cx: number, cy: number) {
    panRef.current = { cx, cy, vb }
  }

  function startPinch() {
    const pts = [...ptrs.current.values()]
    if (pts.length < 2) return
    const [a, b] = pts
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    const fx = (midX - rect.left) / rect.width
    const fy = (midY - rect.top) / rect.height
    pinchRef.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      sx: vb.x + fx * vb.w,
      sy: vb.y + fy * vb.h,
      vb,
    }
    panRef.current = null
  }

  function onPointerDown(e: React.PointerEvent) {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    movedRef.current = false
    if (ptrs.current.size >= 2) startPinch()
    else startPan(e.clientX, e.clientY)
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    function onMove(e: PointerEvent) {
      if (!ptrs.current.has(e.pointerId)) return
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const rect = svg!.getBoundingClientRect()
      const pts = [...ptrs.current.values()]

      if (pts.length >= 2 && pinchRef.current) {
        const [a, b] = pts
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        const fx = (midX - rect.left) / rect.width
        const fy = (midY - rect.top) / rect.height
        const start = pinchRef.current
        const w = (start.vb.w * start.dist) / Math.max(dist, 1)
        const h = w / ASPECT
        movedRef.current = true
        setVb(clamp({ x: start.sx - fx * w, y: start.sy - fy * h, w, h }))
      } else if (pts.length === 1 && panRef.current) {
        const start = panRef.current
        const dx = e.clientX - start.cx
        const dy = e.clientY - start.cy
        if (Math.hypot(dx, dy) > TAP_TOLERANCE) movedRef.current = true
        const sdx = (dx / rect.width) * start.vb.w
        const sdy = (dy / rect.height) * start.vb.h
        setVb(clamp({ ...start.vb, x: start.vb.x - sdx, y: start.vb.y - sdy }))
      }
    }

    function onUp(e: PointerEvent) {
      ptrs.current.delete(e.pointerId)
      if (ptrs.current.size === 0) {
        panRef.current = null
        pinchRef.current = null
      } else if (ptrs.current.size === 1) {
        pinchRef.current = null
        const [p] = [...ptrs.current.values()]
        startPan(p.x, p.y)
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      zoomAround(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      svg.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mode) {
    return (
      <div className="carte setup">
        <h2><IconMap /> Carte de France</h2>
        <div className="setup-buttons">
          <button className="btn-primary" onClick={start}>
            Jouer ({ROUNDS} départements à localiser)
          </button>
          <button className="btn-primary" onClick={() => { sfx.click(); setMode('heatmap') }}>
            Ma heatmap de progression
          </button>
        </div>
      </div>
    )
  }

  const finished = mode === 'jeu' && round >= ROUNDS
  const zoomed = vb.w < BASE.w - 0.5

  return (
    <div className="carte">
      {mode === 'jeu' && !finished && target && (
        <div className="hud">
          <span><IconTarget /> {round + 1}/{ROUNDS}</span>
          <span className="carte-target">
            Clique sur : <strong>{target.nom} ({target.code})</strong>
          </span>
          <span className="score">{score} <IconCheck className="icon-ok" /></span>
        </div>
      )}
      {finished && (
        <div className="carte-done">
          <p className="final-score">{score} / {ROUNDS} <IconTarget className="accent" /></p>
          <button className="btn-primary" onClick={start}>Rejouer</button>
        </div>
      )}
      {mode === 'heatmap' && (
        <p className="hint">
          <IconDot color="#22c55e" /> maîtrisé · <IconDot color="#eab308" /> moyen ·{' '}
          <IconDot color="#ef4444" /> à bosser · <IconDot color="#ffffff" /> jamais croisé
        </p>
      )}

      <div className="map-wrap">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="france-map"
          role="img"
          aria-label="Carte des départements français"
          onPointerDown={onPointerDown}
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
                      : '#ffffff'
            return (
              <path
                key={loc.id}
                ref={(el) => { pathRefs.current[loc.id] = el }}
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

        <div className="map-controls">
          <button onClick={() => zoomButton(1 / 1.6)} aria-label="Zoomer">+</button>
          <button onClick={() => zoomButton(1.6)} aria-label="Dézoomer">−</button>
          <button className="map-idf" onClick={zoomIDF} aria-label="Zoomer sur l’Île-de-France">
            IDF
          </button>
          {zoomed && (
            <button className="map-reset" onClick={() => setVb(BASE)} aria-label="Vue d’ensemble">
              ⤢
            </button>
          )}
        </div>
      </div>

      <p className="map-tip">Pince pour zoomer · glisse pour te déplacer · « IDF » pour la région parisienne</p>
    </div>
  )
}
