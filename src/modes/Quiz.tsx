import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  departements,
  distractors,
  matchesCode,
  matchesNom,
  shuffle,
  type Departement,
} from '../lib/departements.ts'
import { recordAnswer, getBest, setBest, weakWeight } from '../lib/storage.ts'
import {
  IconCheck,
  IconFlame,
  IconKeyboard,
  IconTimer,
  IconTrophy,
  IconX,
  IconZap,
} from '../components/icons.tsx'

const DURATION = 60

type AnswerMode = 'qcm' | 'saisie'
type Phase = 'setup' | 'play' | 'done'

interface Choice {
  label: string
  ok: boolean
}

interface Question {
  dept: Departement
  prompt: ReactNode
  answer: string
  check: (input: string) => boolean
  options?: Choice[]
}

function pickWeighted(): Departement {
  const weights = departements.map((d) => weakWeight(d.code))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < departements.length; i++) {
    r -= weights[i]
    if (r <= 0) return departements[i]
  }
  return departements[departements.length - 1]
}

function makeQuestion(answerMode: AnswerMode): Question {
  const dept = pickWeighted()
  const kind = Math.floor(Math.random() * 3)
  let q: Question

  if (kind === 0) {
    q = {
      dept,
      prompt: <>Quel département porte le numéro <strong>{dept.code}</strong> ?</>,
      answer: dept.nom,
      check: (input) => matchesNom(input, dept),
    }
    if (answerMode === 'qcm') {
      q.options = shuffle([dept, ...distractors(dept)]).map((d) => ({
        label: d.nom,
        ok: d.code === dept.code,
      }))
    }
  } else if (kind === 1) {
    q = {
      dept,
      prompt: <>Quel est le numéro de : <strong>{dept.nom}</strong> ?</>,
      answer: dept.code,
      check: (input) => matchesCode(input, dept),
    }
    if (answerMode === 'qcm') {
      q.options = shuffle([dept, ...distractors(dept)]).map((d) => ({
        label: d.code,
        ok: d.code === dept.code,
      }))
    }
  } else {
    q = {
      dept,
      prompt: <><strong>{dept.prefecture}</strong> est la préfecture de… ?</>,
      answer: `${dept.nom} (${dept.code})`,
      check: (input) => matchesNom(input, dept) || matchesCode(input, dept),
    }
    if (answerMode === 'qcm') {
      q.options = shuffle([dept, ...distractors(dept)]).map((d) => ({
        label: `${d.nom} (${d.code})`,
        ok: d.code === dept.code,
      }))
    }
  }
  return q
}

export default function Quiz() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [answerMode, setAnswerMode] = useState<AnswerMode>('qcm')
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [count, setCount] = useState({ ok: 0, ko: 0 })
  const [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; answer: string } | null>(null)
  const [input, setInput] = useState('')
  const [newRecord, setNewRecord] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const multiplier = 1 + Math.floor(streak / 3)

  useEffect(() => {
    if (phase !== 'play') return
    const t = setTimeout(() => {
      if (timeLeft <= 1) {
        setTimeLeft(0)
        setNewRecord(setBest('quiz', score))
        setPhase('done')
      } else {
        setTimeLeft((s) => s - 1)
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [phase, timeLeft, score])

  function start(mode: AnswerMode) {
    setAnswerMode(mode)
    setScore(0)
    setStreak(0)
    setCount({ ok: 0, ko: 0 })
    setTimeLeft(DURATION)
    setFeedback(null)
    setNewRecord(false)
    setQuestion(makeQuestion(mode))
    setPhase('play')
  }

  function answer(ok: boolean) {
    if (!question) return
    recordAnswer(question.dept.code, ok)
    setFeedback({ ok, answer: question.answer })
    if (ok) {
      setScore((s) => s + 10 * multiplier)
      setStreak((s) => s + 1)
      setCount((c) => ({ ...c, ok: c.ok + 1 }))
    } else {
      setStreak(0)
      setCount((c) => ({ ...c, ko: c.ko + 1 }))
    }
    setTimeout(() => {
      setFeedback(null)
      setInput('')
      setQuestion(makeQuestion(answerMode))
      inputRef.current?.focus()
    }, ok ? 350 : 1100)
  }

  if (phase === 'setup') {
    return (
      <div className="quiz setup">
        <h2><IconZap /> Quiz éclair</h2>
        <p>{DURATION} secondes. Bonne réponse : +10 pts. Série de 3 : multiplicateur !</p>
        <p className="best">Record : {getBest('quiz')} pts</p>
        <div className="setup-buttons">
          <button className="btn-primary" onClick={() => start('qcm')}>QCM (4 choix)</button>
          <button className="btn-primary" onClick={() => start('saisie')}>
            <IconKeyboard /> Saisie clavier
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="quiz done">
        <h2>{newRecord ? <><IconTrophy /> Nouveau record !</> : <><IconTimer /> Terminé !</>}</h2>
        <p className="final-score">{score} pts</p>
        <p>
          <IconCheck className="icon-ok" /> {count.ok} bonnes · <IconX className="icon-ko" /> {count.ko} ratées
        </p>
        <p className="best">Record : {getBest('quiz')} pts</p>
        <button className="btn-primary" onClick={() => setPhase('setup')}>Rejouer</button>
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="quiz play">
      <div className="hud">
        <span className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}><IconTimer /> {timeLeft}s</span>
        <span className="score">{score} pts</span>
        <span className={`streak ${multiplier > 1 ? 'hot' : ''}`}>
          <IconFlame /> {streak} {multiplier > 1 && `(×${multiplier})`}
        </span>
      </div>

      <div className={`question-card ${feedback ? (feedback.ok ? 'flash-ok' : 'flash-ko') : ''}`}>
        <p className="prompt">{question.prompt}</p>

        {feedback && !feedback.ok && (
          <p className="reveal">Réponse : <strong>{feedback.answer}</strong></p>
        )}

        {answerMode === 'qcm' && question.options ? (
          <div className="choices">
            {question.options.map((c) => (
              <button
                key={c.label}
                className="btn-choice"
                disabled={!!feedback}
                onClick={() => answer(c.ok)}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (input.trim() && !feedback) answer(question.check(input))
            }}
          >
            <input
              ref={inputRef}
              autoFocus
              value={input}
              disabled={!!feedback}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ta réponse…"
              autoComplete="off"
            />
            <button className="btn-primary" disabled={!!feedback}>Valider</button>
          </form>
        )}
      </div>
    </div>
  )
}
