import { useState } from 'react'
import { Icon, Lives, useCanopSound, type CanopIconName } from 'canopui'
import {
  byCode,
  departements,
  distractors,
  pickRandom,
  shuffle,
  type Departement,
} from '../lib/departements.ts'
import { recordAnswer, weakWeight } from '../lib/storage.ts'

const LIVES = 10

type ThemeId = 'prefecture' | 'souspref' | 'code' | 'nom' | 'region'

interface Theme {
  id: ThemeId
  icon: CanopIconName
  title: string
  desc: string
}

const THEMES: Theme[] = [
  {
    id: 'prefecture',
    icon: 'bank',
    title: 'Préfectures',
    desc: 'Quelle ville est la préfecture du département ?',
  },
  {
    id: 'souspref',
    icon: 'location',
    title: 'Sous-préfectures',
    desc: 'Retrouve une sous-préfecture du département.',
  },
  {
    id: 'code',
    icon: 'pencil',
    title: 'Codes',
    desc: 'Associe chaque département à son numéro.',
  },
  {
    id: 'nom',
    icon: 'lightning',
    title: 'Noms',
    desc: 'Quel département se cache derrière ce numéro ?',
  },
  {
    id: 'region',
    icon: 'location',
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
  const { play } = useCanopSound()

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
    play(ok ? 'correct' : 'wrong')
    setPicked(option)
    setResults((r) => [...r, { code: question.dept.code, ok }])

    // Passe à la carte suivante automatiquement, comme les autres modes.
    const gameOver = lostLives + (ok ? 0 : 1) >= LIVES
    setTimeout(() => {
      if (gameOver) {
        play('finish')
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
        <h2><Icon name="university" size="sm" /> Entraînement ciblé</h2>
        <p>Choisis un thème et révise-le à fond. Tu as {LIVES} vies : enchaîne les questions tant qu'il t'en reste.</p>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button key={t.id} className="theme-card" onClick={() => { play('start'); start(t.id) }}>
              <span className="theme-icon"><Icon name={t.icon} size="lg" /></span>
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
        <h2>Plus de vies ! <Icon name="star" size="sm" /></h2>
        <p className="final-score">{ok} bonnes réponses</p>
        <p className="final-sub">{results.length} questions tentées</p>
        <ul className="recap">
          {results.map((r, i) => {
            const d = byCode[r.code]
            return (
              <li key={`${r.code}-${i}`}>
                {r.ok ? (
                  <Icon name="check" size="sm" color="success" />
                ) : (
                  <Icon name="close" size="sm" color="error" />
                )}{' '}
                {d.code} — {d.nom}
              </li>
            )
          })}
        </ul>
        <div className="setup-buttons">
          <button className="btn-primary" onClick={() => { play('start'); start(theme) }}>Rejouer ce thème</button>
          <button className="btn-back" onClick={() => { play('click'); setTheme(null) }}>Changer de thème</button>
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
        <Lives value={livesLeft} max={LIVES} ariaLabel={`${livesLeft} vies restantes`} />
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
