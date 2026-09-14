import { createLocalStore } from 'canopui'
import type { Departement } from './departements.ts'

export interface DeptStats {
  seen: number
  ok: number
  ko: number
}

export interface SrsCard {
  box: number
  due: number
}

export interface DailyState {
  guesses: string[]
  done: boolean
  won: boolean
}

interface SaveState {
  stats: Record<string, DeptStats>
  srs: Record<string, SrsCard>
  daily: Record<string, DailyState>
  best: Record<string, number>
}

const INITIAL: SaveState = { stats: {}, srs: {}, daily: {}, best: {} }

const INTERVALS = [0, 1, 3, 7, 30]
const DAY_MS = 86_400_000
const MAX_BOX = INTERVALS.length - 1

function isPartialSave(value: unknown): value is Partial<SaveState> {
  return typeof value === 'object' && value !== null
}

// Les parties déjà jouées ont été écrites sous cette même clé, mais sans
// enveloppe de version : le magasin les relit comme venant de la version 0 et
// les repasse ici, ce qui préserve la progression des joueurs.
const store = createLocalStore<SaveState>({
  key: 'departemental:v1',
  initial: INITIAL,
  migrate: (stored) => (isPartialSave(stored) ? { ...INITIAL, ...stored } : null),
})

export function load(): SaveState {
  return store.get()
}

export function recordAnswer(code: string, correct: boolean): SaveState {
  return store.set((current) => {
    const previous = current.stats[code] ?? { seen: 0, ok: 0, ko: 0 }
    const box = correct ? Math.min((current.srs[code]?.box ?? 0) + 1, MAX_BOX) : 0
    return {
      ...current,
      stats: {
        ...current.stats,
        [code]: {
          seen: previous.seen + 1,
          ok: previous.ok + (correct ? 1 : 0),
          ko: previous.ko + (correct ? 0 : 1),
        },
      },
      srs: {
        ...current.srs,
        [code]: { box, due: Date.now() + INTERVALS[box] * DAY_MS },
      },
    }
  })
}

function weakWeight(code: string): number {
  const s = store.get().stats[code]
  if (!s) return 3
  return 1 + (s.ko * 4) / s.seen
}

/** Pondère le tirage vers les départements les moins maîtrisés. */
export function pickWeighted(pool: Departement[]): Departement {
  const weights = pool.map((d) => weakWeight(d.code))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

export function getDaily(dateKey: string): DailyState | null {
  return store.get().daily[dateKey] ?? null
}

export function setDaily(dateKey: string, value: DailyState): void {
  store.set((current) => ({ ...current, daily: { ...current.daily, [dateKey]: value } }))
}

export function getBest(mode: string): number {
  return store.get().best[mode] ?? 0
}

export function setBest(mode: string, score: number): boolean {
  if (score <= getBest(mode)) return false
  store.set((current) => ({ ...current, best: { ...current.best, [mode]: score } }))
  return true
}
