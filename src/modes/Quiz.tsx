import { useEffect, useState, type FormEventHandler, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Button,
  Card,
  CardGrid,
  Choice,
  Countdown,
  Heading,
  Icon,
  Input,
  SegmentedControl,
  Stack,
  StatCard,
  Streak,
  Text,
  useCanopSound,
  useEnterAnimation,
  useStagger,
  type CanopCardFlash,
  type CanopChoiceState,
  type CanopSegmentedControlOption,
} from 'canopui'
import {
  departements,
  distractors,
  matchesCode,
  matchesNom,
  shuffle,
  type Departement,
} from '../lib/departements.ts'
import { recordAnswer, getBest, setBest, weakWeight } from '../lib/storage.ts'

const DURATION = 60
const DURATION_MS = DURATION * 1000
const URGENT_SECONDS = 10
const HOLD_OK = 350
const HOLD_KO = 1100

type AnswerMode = 'qcm' | 'saisie'
type Phase = 'setup' | 'play' | 'done'

interface Option {
  label: string
  ok: boolean
}

interface Question {
  dept: Departement
  prompt: ReactNode
  answer: string
  check: (input: string) => boolean
  options?: Option[]
}

interface Verdict {
  ok: boolean
  chosen?: string
}

interface Tally {
  ok: number
  ko: number
}

const ANSWER_MODES: CanopSegmentedControlOption<AnswerMode>[] = [
  { value: 'qcm', label: 'QCM' },
  { value: 'saisie', label: 'Saisie clavier' },
]

const STRETCH = { display: 'flex' } as const

interface ViewInProps {
  children: ReactNode
}

function ViewIn({ children }: ViewInProps) {
  const enter = useEnterAnimation()

  return (
    <motion.div initial={enter.initial} animate={enter.animate} transition={enter.transition}>
      {children}
    </motion.div>
  )
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

function choiceState(option: Option, verdict: Verdict | null): CanopChoiceState {
  if (!verdict) return 'neutral'
  if (option.ok) return 'correct'
  return option.label === verdict.chosen ? 'incorrect' : 'neutral'
}

function cardFlash(verdict: Verdict | null): CanopCardFlash | undefined {
  if (!verdict) return undefined
  return verdict.ok ? 'success' : 'error'
}

interface BestLineProps {
  best: number
}

function BestLine({ best }: BestLineProps) {
  return (
    <Stack direction="row" gap="xs" alignItems="center" justifyContent="center">
      <Icon name="award" size="sm" color="warning" variant="solid" />
      <Text variant="label" tone="muted" as="span">
        Record : {best} pts
      </Text>
    </Stack>
  )
}

interface SetupProps {
  answerMode: AnswerMode
  onAnswerModeChange: (mode: AnswerMode) => void
  onStart: () => void
}

function Setup({ answerMode, onAnswerModeChange, onStart }: SetupProps) {
  return (
    <Stack gap="lg">
      <Stack gap="xs" alignItems="center">
        <Icon name="lightning" size="xl" color="primary" variant="solid" />
        <Heading level={2} align="center" gutterBottom={false}>
          Quiz éclair
        </Heading>
        <Text variant="lead" tone="muted" align="center">
          {DURATION} secondes. Bonne réponse : +10 pts. Série de 3 : multiplicateur !
        </Text>
      </Stack>

      <Card radius="xl">
        <Stack gap="md" alignItems="center">
          <Text variant="label" tone="muted" as="span">
            Comment veux-tu répondre ?
          </Text>
          <SegmentedControl
            options={ANSWER_MODES}
            value={answerMode}
            onChange={onAnswerModeChange}
            ariaLabel="Mode de réponse"
            fullWidth
          />
          <Button
            size="large"
            fullWidth
            onClick={onStart}
            startIcon={<Icon name="play" size="sm" variant="solid" />}
          >
            Commencer
          </Button>
        </Stack>
      </Card>

      <BestLine best={getBest('quiz')} />
    </Stack>
  )
}

interface HudProps {
  game: number
  score: number
  streak: number
  multiplier: number
  onTimeout: () => void
}

function Hud({ game, score, streak, multiplier, onTimeout }: HudProps) {
  return (
    <Stack gap="xs">
      <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between">
        <Text variant="label" weight="bold" tabularNums as="span">
          {score} pts
        </Text>
        <Streak
          value={streak}
          multiplier={multiplier}
          ariaLabel={`Série de ${streak}, multiplicateur ${multiplier}`}
        />
      </Stack>
      <Countdown
        key={game}
        duration={DURATION_MS}
        urgentBelow={URGENT_SECONDS}
        onEnd={onTimeout}
      />
    </Stack>
  )
}

interface ChoicesProps {
  round: number
  options: Option[]
  verdict: Verdict | null
  onAnswer: (option: Option) => void
}

function Choices({ round, options, verdict, onAnswer }: ChoicesProps) {
  const cascade = useStagger()

  return (
    <motion.div key={round} {...cascade.container}>
      <CardGrid minItemWidth="12rem" gap="sm">
        {options.map((option) => (
          <motion.div key={option.label} variants={cascade.item.variants} style={STRETCH}>
            <Choice
              state={choiceState(option, verdict)}
              disabled={verdict !== null}
              onClick={() => onAnswer(option)}
            >
              <Text variant="body-md" as="span">
                {option.label}
              </Text>
            </Choice>
          </motion.div>
        ))}
      </CardGrid>
    </motion.div>
  )
}

interface RevealProps {
  answer: string
}

function Reveal({ answer }: RevealProps) {
  return (
    <Stack direction="row" gap="xs" alignItems="center" justifyContent="center">
      <Icon name="close" size="sm" color="error" variant="solid" />
      <Text variant="label" tone="error" weight="bold" as="span">
        Réponse : {answer}
      </Text>
    </Stack>
  )
}

interface TypedAnswerProps {
  round: number
  value: string
  locked: boolean
  onChange: (value: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

function TypedAnswer({ round, value, locked, onChange, onSubmit }: TypedAnswerProps) {
  return (
    <Stack as="form" gap="sm" onSubmit={onSubmit}>
      <Input
        key={round}
        label="Ta réponse"
        value={value}
        onChange={onChange}
        disabled={locked}
        autoFocus
        autoComplete="off"
      />
      <Button
        type="submit"
        fullWidth
        disabled={locked}
        endIcon={<Icon name="arrowRight" size="sm" />}
      >
        Valider
      </Button>
    </Stack>
  )
}

interface DoneProps {
  score: number
  count: Tally
  newRecord: boolean
  onReplay: () => void
}

function Done({ score, count, newRecord, onReplay }: DoneProps) {
  return (
    <Stack gap="lg">
      <Stack gap="xs" alignItems="center">
        <Icon
          name={newRecord ? 'award' : 'timer'}
          size="xl"
          variant="solid"
          color={newRecord ? 'warning' : 'primary'}
        />
        <Heading level={2} align="center" gutterBottom={false}>
          {newRecord ? 'Nouveau record !' : 'Terminé !'}
        </Heading>
      </Stack>

      <CardGrid minItemWidth="9rem" gap="sm">
        <StatCard
          label="Score"
          value={`${score} pts`}
          icon="lightning"
          tone={newRecord ? 'success' : 'neutral'}
        />
        <StatCard label="Bonnes" value={`${count.ok}`} icon="check" iconColor="success" />
        <StatCard label="Ratées" value={`${count.ko}`} icon="close" iconColor="error" />
        <StatCard
          label="Record"
          value={`${getBest('quiz')} pts`}
          icon="award"
          iconColor="warning"
        />
      </CardGrid>

      <Button
        size="large"
        fullWidth
        onClick={onReplay}
        startIcon={<Icon name="refresh" size="sm" />}
      >
        Rejouer
      </Button>
    </Stack>
  )
}

export default function Quiz() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [answerMode, setAnswerMode] = useState<AnswerMode>('qcm')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [count, setCount] = useState<Tally>({ ok: 0, ko: 0 })
  const [question, setQuestion] = useState<Question | null>(null)
  const [round, setRound] = useState(0)
  const [game, setGame] = useState(0)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [input, setInput] = useState('')
  const [newRecord, setNewRecord] = useState(false)
  const { play } = useCanopSound()

  const multiplier = 1 + Math.floor(streak / 3)

  useEffect(() => {
    if (!verdict) return
    const id = window.setTimeout(
      () => {
        setVerdict(null)
        setInput('')
        setQuestion(makeQuestion(answerMode))
        setRound((value) => value + 1)
      },
      verdict.ok ? HOLD_OK : HOLD_KO,
    )
    return () => window.clearTimeout(id)
  }, [verdict, answerMode])

  function start() {
    play('start')
    setScore(0)
    setStreak(0)
    setCount({ ok: 0, ko: 0 })
    setVerdict(null)
    setInput('')
    setNewRecord(false)
    setQuestion(makeQuestion(answerMode))
    setRound((value) => value + 1)
    setGame((value) => value + 1)
    setPhase('play')
  }

  function endGame() {
    setNewRecord(setBest('quiz', score))
    play('finish')
    setPhase('done')
  }

  function answer(ok: boolean, chosen?: string) {
    if (!question || verdict) return
    recordAnswer(question.dept.code, ok)
    play(ok ? 'correct' : 'wrong')
    setVerdict({ ok, chosen })
    if (ok) {
      setScore((value) => value + 10 * multiplier)
      setStreak((value) => value + 1)
      setCount((value) => ({ ...value, ok: value.ok + 1 }))
    } else {
      setStreak(0)
      setCount((value) => ({ ...value, ko: value.ko + 1 }))
    }
  }

  const submitTyped: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    if (!question || verdict || !input.trim()) return
    answer(question.check(input))
  }

  if (phase === 'setup') {
    return (
      <ViewIn key="setup">
        <Setup answerMode={answerMode} onAnswerModeChange={setAnswerMode} onStart={start} />
      </ViewIn>
    )
  }

  if (phase === 'done') {
    return (
      <ViewIn key="done">
        <Done
          score={score}
          count={count}
          newRecord={newRecord}
          onReplay={() => setPhase('setup')}
        />
      </ViewIn>
    )
  }

  if (!question) return null

  return (
    <ViewIn key="play">
      <Stack gap="md">
        <Hud
          game={game}
          score={score}
          streak={streak}
          multiplier={multiplier}
          onTimeout={endGame}
        />

        <Card radius="xl" elevation="md" flash={cardFlash(verdict)}>
          <Stack gap="lg">
            <Text variant="lead" align="center">
              {question.prompt}
            </Text>

            {answerMode === 'qcm' && question.options ? (
              <Choices
                round={round}
                options={question.options}
                verdict={verdict}
                onAnswer={(option) => answer(option.ok, option.label)}
              />
            ) : (
              <Stack gap="sm">
                {verdict && !verdict.ok && <Reveal answer={question.answer} />}
                <TypedAnswer
                  round={round}
                  value={input}
                  locked={verdict !== null}
                  onChange={setInput}
                  onSubmit={submitTyped}
                />
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>
    </ViewIn>
  )
}
