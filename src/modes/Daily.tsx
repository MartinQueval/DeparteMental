import { useMemo, useState } from 'react'
import {
  byCode,
  codeValue,
  departements,
  normalize,
  type Departement,
} from '../lib/departements.ts'
import { getDaily, setDaily, recordAnswer, type DailyState } from '../lib/storage.ts'
import { sfx } from '../lib/sound.ts'
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconCheck,
  IconClipboard,
  IconLandmark,
  IconMapPin,
  IconRuler,
  IconSparkle,
  IconTarget,
  IconType,
  IconX,
} from '../components/icons.tsx'

const MAX_GUESSES = 6

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dailyDept(dateKey: string): Departement {
  let h = 2166136261
  for (const c of dateKey) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return departements[Math.abs(h) % departements.length]
}

function hints(target: Departement, wrongCount: number) {
  const all = [
    { Icon: IconMapPin, text: `Région : ${target.region}` },
    { Icon: IconType, text: `Le nom commence par « ${target.nom[0]} »` },
    { Icon: IconRuler, text: `Le nom fait ${target.nom.length} caractères` },
    { Icon: IconLandmark, text: `La préfecture commence par « ${target.prefecture[0]} »` },
    { Icon: IconLandmark, text: `Préfecture : ${target.prefecture}` },
  ]
  return all.slice(0, wrongCount)
}

function GuessRow({ guess, target }: { guess: string; target: Departement }) {
  const d = byCode[guess]
  const codeDiff = codeValue(target.code) - codeValue(d.code)
  return (
    <div className={`guess-row ${d.code === target.code ? 'guess-win' : ''}`}>
      <span className="guess-nom">{d.nom}</span>
      <span className="guess-cell">
        {d.code === target.code ? (
          <IconTarget className="icon-ok" />
        ) : codeDiff > 0 ? (
          <><IconArrowUp /> n° plus grand</>
        ) : (
          <><IconArrowDown /> n° plus petit</>
        )}
      </span>
      <span className="guess-cell">
        {d.region === target.region ? (
          <><IconCheck className="icon-ok" /> région</>
        ) : (
          <><IconX className="icon-ko" /> région</>
        )}
      </span>
    </div>
  )
}

export default function Daily() {
  const dateKey = todayKey()
  const target = useMemo(() => dailyDept(dateKey), [dateKey])
  const [state, setState] = useState<DailyState>(
    () => getDaily(dateKey) ?? { guesses: [], done: false, won: false }
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const found = departements.find((d) => normalize(d.nom) === normalize(input))
    if (!found) {
      setError('Département inconnu — choisis dans la liste !')
      return
    }
    if (state.guesses.includes(found.code)) {
      setError('Déjà essayé !')
      return
    }
    setError('')
    setInput('')
    const guesses = [...state.guesses, found.code]
    const won = found.code === target.code
    const done = won || guesses.length >= MAX_GUESSES
    if (done) recordAnswer(target.code, won)
    if (won) sfx.finish()
    else if (done) sfx.wrong()
    else sfx.click()
    const next: DailyState = { guesses, done, won }
    setState(next)
    setDaily(dateKey, next)
  }

  function share() {
    const grid = state.guesses
      .map((c) => {
        const d = byCode[c]
        if (c === target.code) return '🟩🟩'
        return `${d.region === target.region ? '🟨' : '⬛'}${Math.abs(codeValue(d.code) - codeValue(target.code)) <= 10 ? '🟨' : '⬛'}`
      })
      .join('\n')
    const text = `DéparteMental ${dateKey} — ${state.won ? state.guesses.length : 'X'}/${MAX_GUESSES}\n${grid}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const wrongCount = state.guesses.filter((c) => c !== target.code).length

  return (
    <div className="daily">
      <h2><IconCalendar /> Défi du jour</h2>
      <p>Devine le département mystère en {MAX_GUESSES} essais max.</p>

      {hints(target, Math.min(wrongCount, 5)).map(({ Icon, text }) => (
        <p key={text} className="hint"><Icon /> {text}</p>
      ))}

      <div className="guesses">
        {state.guesses.map((g) => (
          <GuessRow key={g} guess={g} target={target} />
        ))}
      </div>

      {!state.done ? (
        <form onSubmit={submit} className="daily-form">
          <input
            list="depts"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Essai ${state.guesses.length + 1}/${MAX_GUESSES}…`}
            autoComplete="off"
          />
          <datalist id="depts">
            {departements.map((d) => (
              <option key={d.code} value={d.nom} />
            ))}
          </datalist>
          <button className="btn-primary">Deviner</button>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <div className="daily-result">
          {state.won ? (
            <p className="final-score">
              Bravo ! <IconSparkle className="accent" /> {state.guesses.length}/{MAX_GUESSES}
            </p>
          ) : (
            <p className="final-score">
              Raté ! C’était <strong>{target.nom} ({target.code})</strong>
            </p>
          )}
          <p>
            <IconLandmark /> Préfecture : {target.prefecture}
            {target.sousPrefectures.length > 0 &&
              ` · Sous-préf. : ${target.sousPrefectures.join(', ')}`}
          </p>
          <button className="btn-primary" onClick={share}>
            {copied ? <><IconCheck /> Copié !</> : <><IconClipboard /> Partager le résultat</>}
          </button>
          <p className="hint">Reviens demain pour un nouveau département !</p>
        </div>
      )}
    </div>
  )
}
