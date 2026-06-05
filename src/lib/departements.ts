import data from '../data/departements.json'

export interface Departement {
  code: string
  nom: string
  prefecture: string
  sousPrefectures: string[]
  region: string
}

export const departements: Departement[] = data

export const byCode: Record<string, Departement> = Object.fromEntries(
  departements.map((d) => [d.code, d])
)

export function codeValue(code: string): number {
  if (code === '2A') return 20.1
  if (code === '2B') return 20.2
  return Number(code)
}

export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-'’\s]+/g, ' ')
    .trim()
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function distractors(target: Departement, count = 3): Departement[] {
  const targetWords = new Set(normalize(target.nom).split(' '))
  const scored = departements
    .filter((d) => d.code !== target.code)
    .map((d) => {
      let score = 0
      const codeDist = Math.abs(codeValue(d.code) - codeValue(target.code))
      if (codeDist <= 3) score += 3
      else if (codeDist <= 10) score += 1
      if (d.region === target.region) score += 2
      const words = normalize(d.nom).split(' ')
      if (words.some((w) => w.length > 3 && targetWords.has(w))) score += 4
      score += Math.random() * 2
      return { d, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, count).map((s) => s.d)
}

export function matchesNom(input: string, dept: Departement): boolean {
  return normalize(input) === normalize(dept.nom)
}

export function matchesCode(input: string, dept: Departement): boolean {
  return (
    input.trim().toUpperCase().replace(/^0+(?=\d)/, '') ===
    dept.code.toUpperCase().replace(/^0+(?=\d)/, '')
  )
}
