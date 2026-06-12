import { useState } from 'react'
import {
  byCode,
  departements,
  distractors,
  pickRandom,
  shuffle,
  type Departement,
} from '../lib/departements.ts'
import { recordAnswer, weakWeight } from '../lib/storage.ts'
import { sfx } from '../lib/sound.ts'
import {
  IconCheck,
  IconGraduationCap,
  IconLandmark,
  IconMapPin,
  IconSparkle,
  IconType,
  IconX,
  IconZap,
  IconHeart,
  type IconComponent,
} from '../components/icons.tsx'

const LIVES = 10

type ThemeId = 'prefecture' | 'souspref' | 'code' | 'nom' | 'region'

interface Theme {
  id: ThemeId
  icon: IconComponent
  title: string
  desc: string
}

const THEMES: Theme[] = [
  {
    id: 'prefecture',
    icon: IconLandmark,
    title: 'Préfectures',
    desc: 'Quelle ville est la préfecture du département ?',
  },
  {
    id: 'souspref',
    icon: IconMapPin,
    title: 'Sous-préfectures',
    desc: 'Retrouve une sous-préfecture du département.',
  },
  {
    id: 'code',
    icon: IconType,
    title: 'Codes',
    desc: 'Associe chaque département à son numéro.',
  },
  {
    id: 'nom',
    icon: IconZap,
    title: 'Noms',
    desc: 'Quel département se cache derrière ce numéro ?',
  },
  {
    id: 'region',
    icon: IconMapPin,
    title: 'Régions',
    desc: 'Dans quelle région se trouve le département ?',
  },
]

interface Question {
  dept: Departement
  prompt: string
  answer: string
  options: string[]
}

/** Pondère le tirage vers les départements les moins maîtrisés. */
function pickWeighted(pool: Departement[]): Departement {
  const weights = pool.map((d) => weakWeight(d.code))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

/** Construit 4 choix : la bonne réponse + 3 leurres uniques tirés du pool. */
function buildOptions(answer: string, candidates: string[], fallback: string[]): string[] {
  const seen = new Set([answer])
  const wrong: string[] = []
  for (const c of [...candidates, ...fallback]) {
    if (wrong.length >= 3) break
    if (!seen.has(c)) {
      seen.add(c)
      wrong.push(c)
    }
  }
  return shuffle([answer, ...wrong])
}

function makeQuestion(theme: ThemeId): Question {
  if (theme === 'souspref') {
    const pool = departements.filter((d) => d.sousPrefectures.length > 0)
    const dept = pickWeighted(pool)
    const answer = pickRandom(dept.sousPrefectures)
    const ownCities = new Set([dept.prefecture, ...dept.sousPrefectures])
    const near = distractors(dept, 6).flatMap((d) => [d.prefecture, ...d.sousPrefectures])
    const fallback = departements.flatMap((d) => [d.prefecture, ...d.sousPrefectures])
    return {
      dept,
      prompt: `Quelle ville est une sous-préfecture de ${dept.nom} (${dept.code}) ?`,
      answer,
      options: buildOptions(
        answer,
        near.filter((c) => !ownCities.has(c)),
        fallback.filter((c) => !ownCities.has(c)),
      ),
    }
  }

  const dept = pickWeighted(departements)
  const near = distractors(dept, 6)

  if (theme === 'prefecture') {
    return {
      dept,
      prompt: `Quelle est la préfecture de ${dept.nom} (${dept.code}) ?`,
      answer: dept.prefecture,
      options: buildOptions(
        dept.prefecture,
        near.map((d) => d.prefecture),
        departements.map((d) => d.prefecture),
      ),
    }
  }

  if (theme === 'code') {
    return {
      dept,
      prompt: `Quel est le numéro du département ${dept.nom} ?`,
      answer: dept.code,
      options: buildOptions(
        dept.code,
        near.map((d) => d.code),
        departements.map((d) => d.code),
      ),
    }
  }

  if (theme === 'nom') {
    return {
      dept,
      prompt: `Quel département porte le numéro ${dept.code} ?`,
      answer: dept.nom,
      options: buildOptions(
        dept.nom,
        near.map((d) => d.nom),
        departements.map((d) => d.nom),
      ),
    }
  }

  // region
  return {
    dept,
    prompt: `Dans quelle région se trouve ${dept.nom} (${dept.code}) ?`,
    answer: dept.region,
    options: buildOptions(
      dept.region,
      near.map((d) => d.region),
      departements.map((d) => d.region),
    ),
  }
}

interface Result {
  code: string
  ok: boolean
}

export default function Entrainement() {
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [finished, setFinished] = useState(false)

  const lostLives = results.filter((r) => !r.ok).length
  const livesLeft = Math.max(0, LIVES - lostLives)

  function start(id: ThemeId) {
    setTheme(id)
    setIndex(0)
    setResults([])
    setPicked(null)
    setFinished(false)
    setQuestion(makeQuestion(id))
  }

  function choose(option: string) {
    if (!question || picked || !theme) return
    const ok = option === question.answer
    recordAnswer(question.dept.code, ok)
    if (ok) sfx.correct()
    else sfx.wrong()
    setPicked(option)
    setResults((r) => [...r, { code: question.dept.code, ok }])

    // Passe à la carte suivante automatiquement, comme les autres modes.
    const gameOver = lostLives + (ok ? 0 : 1) >= LIVES
    setTimeout(() => {
      if (gameOver) {
        sfx.finish()
        setFinished(true)
        return
      }
      setIndex((i) => i + 1)
      setPicked(null)
      setQuestion(makeQuestion(theme))
    }, ok ? 600 : 1100)
  }

  // --- Choix du thème ---
  if (!theme) {
    return (
      <div className="entrainement setup">
        <h2><IconGraduationCap /> Entraînement ciblé</h2>
        <p>Choisis un thème et révise-le à fond. Tu as {LIVES} vies : enchaîne les questions tant qu'il t'en reste.</p>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button key={t.id} className="theme-card" onClick={() => { sfx.start(); start(t.id) }}>
              <span className="theme-icon"><t.icon /></span>
              <span className="theme-title">{t.title}</span>
              <span className="theme-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // --- Récap ---
  if (finished) {
    const ok = results.filter((r) => r.ok).length
    return (
      <div className="entrainement done">
        <h2>Plus de vies ! <IconSparkle /></h2>
        <p className="final-score">{ok} bonnes réponses</p>
        <p className="final-sub">{results.length} questions tentées</p>
        <ul className="recap">
          {results.map((r, i) => {
            const d = byCode[r.code]
            return (
              <li key={`${r.code}-${i}`}>
                {r.ok ? <IconCheck className="icon-ok" /> : <IconX className="icon-ko" />} {d.code} — {d.nom}
              </li>
            )
          })}
        </ul>
        <div className="setup-buttons">
          <button className="btn-primary" onClick={() => { sfx.start(); start(theme) }}>Rejouer ce thème</button>
          <button className="btn-back" onClick={() => { sfx.click(); setTheme(null) }}>Changer de thème</button>
        </div>
      </div>
    )
  }

  // --- Jeu ---
  if (!question) return null

  return (
    <div className="entrainement play">
      <div className="play-status">
        <span className="card-count">Question {index + 1}</span>
        <span className="lives" aria-label={`${livesLeft} vies restantes`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <IconHeart key={i} className={i < livesLeft ? 'life' : 'life lost'} />
          ))}
        </span>
      </div>
      <div className="question-card">
        <p className="prompt">{question.prompt}</p>
        <div className="choices">
          {question.options.map((opt) => {
            let cls = 'btn-choice'
            if (picked) {
              if (opt === question.answer) cls += ' choice-ok'
              else if (opt === picked) cls += ' choice-ko'
            }
            return (
              <button
                key={opt}
                className={cls}
                disabled={!!picked}
                onClick={() => choose(opt)}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
