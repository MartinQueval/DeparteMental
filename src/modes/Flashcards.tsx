import { useState } from 'react'
import { byCode, departements, shuffle } from '../lib/departements.ts'
import { dueCards, recordAnswer, load, MAX_BOX } from '../lib/storage.ts'

const SESSION_SIZE = 10

interface Result {
  code: string
  known: boolean
}

export default function Flashcards() {
  const [session, setSession] = useState<string[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<Result[]>([])

  function start() {
    const codes = dueCards(departements.map((d) => d.code), SESSION_SIZE)
    setSession(shuffle(codes))
    setIndex(0)
    setFlipped(false)
    setResults([])
  }

  function grade(known: boolean) {
    if (!session) return
    const code = session[index]
    recordAnswer(code, known)
    setResults((r) => [...r, { code, known }])
    setFlipped(false)
    setIndex((i) => i + 1)
  }

  if (!session) {
    const { srs } = load()
    const due = dueCards(departements.map((d) => d.code), 101).length
    const learned = Object.values(srs).filter((c) => c.box >= MAX_BOX).length
    return (
      <div className="cards setup">
        <h2>🃏 Flashcards</h2>
        <p>
          Répétition espacée (boîtes de Leitner) : les départements ratés reviennent
          vite, ceux que tu maîtrises s’espacent jusqu’à 30 jours.
        </p>
        <p className="best">
          📥 {Math.min(due, SESSION_SIZE)} cartes à réviser · 🎓 {learned} bien ancrés
        </p>
        <button className="btn-primary" onClick={start}>
          Démarrer la session
        </button>
      </div>
    )
  }

  if (index >= session.length) {
    const ok = results.filter((r) => r.known).length
    return (
      <div className="cards done">
        <h2>Session terminée 🎉</h2>
        <p className="final-score">
          {ok} / {results.length} connues
        </p>
        <ul className="recap">
          {results.map((r) => {
            const d = byCode[r.code]
            return (
              <li key={r.code}>
                {r.known ? '✅' : '❌'} {d.code} — {d.nom}
              </li>
            )
          })}
        </ul>
        <button className="btn-primary" onClick={start}>Nouvelle session</button>
      </div>
    )
  }

  const dept = byCode[session[index]]
  return (
    <div className="cards play">
      <p className="card-count">
        Carte {index + 1} / {session.length}
      </p>
      <button
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped(true)}
      >
        {!flipped ? (
          <span className="card-front">
            <span className="card-code">{dept.code}</span>
            <span className="card-hint">Nom ? Préfecture ? (tape pour révéler)</span>
          </span>
        ) : (
          <span className="card-back">
            <span className="card-nom">{dept.nom}</span>
            <span className="card-pref">🏛️ {dept.prefecture}</span>
            {dept.sousPrefectures.length > 0 && (
              <span className="card-souspref">{dept.sousPrefectures.join(' · ')}</span>
            )}
            <span className="card-region">📍 {dept.region}</span>
          </span>
        )}
      </button>
      {flipped && (
        <div className="grade-buttons">
          <button className="btn-ko" onClick={() => grade(false)}>
            ❌ À revoir
          </button>
          <button className="btn-ok" onClick={() => grade(true)}>
            ✅ Je savais
          </button>
        </div>
      )}
    </div>
  )
}
