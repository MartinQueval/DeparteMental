const KEY = 'departemental:v1'

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

const DEFAULT: SaveState = { stats: {}, srs: {}, daily: {}, best: {} }

export function load(): SaveState {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? 'null') }
  } catch {
    return { ...DEFAULT }
  }
}

function save(state: SaveState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

const INTERVALS = [0, 1, 3, 7, 30]
export const MAX_BOX = INTERVALS.length - 1

export function recordAnswer(code: string, correct: boolean): SaveState {
  const state = load()
  const s = state.stats[code] ?? { seen: 0, ok: 0, ko: 0 }
  s.seen += 1
  if (correct) s.ok += 1
  else s.ko += 1
  state.stats[code] = s

  const card = state.srs[code] ?? { box: 0, due: Date.now() }
  card.box = correct ? Math.min(card.box + 1, MAX_BOX) : 0
  card.due = Date.now() + INTERVALS[card.box] * 86_400_000
  state.srs[code] = card

  save(state)
  return state
}

export function dueCards(allCodes: string[], limit = 10): string[] {
  const { srs } = load()
  const now = Date.now()
  const due = allCodes
    .filter((c) => srs[c] && srs[c].due <= now)
    .sort((a, b) => srs[a].due - srs[b].due)
  const fresh = allCodes.filter((c) => !srs[c])
  return [...due, ...fresh].slice(0, limit)
}

export function weakWeight(code: string): number {
  const s = load().stats[code]
  if (!s) return 3
  return 1 + (s.ko * 4) / s.seen
}

export function getDaily(dateKey: string): DailyState | null {
  return load().daily[dateKey] ?? null
}

export function setDaily(dateKey: string, value: DailyState): void {
  const state = load()
  state.daily[dateKey] = value
  save(state)
}

export function getBest(mode: string): number {
  return load().best[mode] ?? 0
}

export function setBest(mode: string, score: number): boolean {
  const state = load()
  if (score > (state.best[mode] ?? 0)) {
    state.best[mode] = score
    save(state)
    return true
  }
  return false
}
