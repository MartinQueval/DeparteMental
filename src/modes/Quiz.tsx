import { useEffect, useMemo, useState, type FormEventHandler } from 'react'
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
  useTranslation,
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
import { Emphasis } from '../lib/emphasis.tsx'
import { Cascade, CascadeItem, ViewIn } from '../lib/motion.tsx'
import { recordAnswer, getBest, pickWeighted, setBest } from '../lib/storage.ts'

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
  promptKey: string
  promptValue: string
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

function useAnswerModes(): CanopSegmentedControlOption<AnswerMode>[] {
  const { t } = useTranslation()

  return useMemo<CanopSegmentedControlOption<AnswerMode>[]>(
    () => [
      { value: 'qcm', label: t('dm.quiz.answerMode.choices') },
      { value: 'saisie', label: t('dm.quiz.answerMode.typing') },
    ],
    [t]
  )
}

function makeQuestion(answerMode: AnswerMode): Question {
  const dept = pickWeighted(departements)
  const kind = Math.floor(Math.random() * 3)
  let q: Question

  if (kind === 0) {
    q = {
      dept,
      promptKey: 'dm.quiz.prompt.name',
      promptValue: dept.code,
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
      promptKey: 'dm.quiz.prompt.code',
      promptValue: dept.nom,
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
      promptKey: 'dm.quiz.prompt.prefecture',
      promptValue: dept.prefecture,
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
  const { t } = useTranslation()

  return (
    <Stack direction="row" gap="xs" alignItems="center" justifyContent="center">
      <Icon name="award" size="sm" color="warning" variant="solid" />
      <Text variant="label" tone="muted" as="span">
        {t('dm.quiz.best', { value: best })}
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
  const { t } = useTranslation()
  const answerModes = useAnswerModes()

  return (
    <Card radius="xl">
      <Stack gap="lg" alignItems="stretch">
        <Stack gap="xs" alignItems="center">
          <Icon name="lightning" size="xl" color="primary" variant="solid" />
          <Heading level={2} align="center" gutterBottom={false}>
            {t('dm.mode.quiz.title')}
          </Heading>
          <Text variant="lead" tone="muted" align="center">
            {t('dm.quiz.setup.rules', { duration: DURATION })}
          </Text>
        </Stack>

        <Stack gap="md" alignItems="center">
          <Text variant="label" tone="muted" as="span">
            {t('dm.quiz.setup.question')}
          </Text>
          <SegmentedControl
            options={answerModes}
            value={answerMode}
            onChange={onAnswerModeChange}
            ariaLabel={t('dm.quiz.answerMode.label')}
            fullWidth
          />
          <Button
            size="large"
            fullWidth
            onClick={onStart}
            startIcon={<Icon name="play" size="sm" variant="solid" />}
          >
            {t('dm.quiz.setup.start')}
          </Button>
        </Stack>

        <BestLine best={getBest('quiz')} />
      </Stack>
    </Card>
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
  const { t } = useTranslation()

  return (
    <Stack gap="xs">
      <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between">
        <Text variant="label" weight="bold" tabularNums as="span">
          {t('dm.quiz.points', { value: score })}
        </Text>
        <Streak
          value={streak}
          multiplier={multiplier}
          ariaLabel={t('dm.quiz.streak', { value: streak, multiplier })}
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
  return (
    <Cascade key={round}>
      <CardGrid minItemWidth="12rem" gap="sm">
        {options.map((option) => (
          <CascadeItem key={option.label} stretch>
            <Choice
              state={choiceState(option, verdict)}
              disabled={verdict !== null}
              onClick={() => onAnswer(option)}
            >
              <Text variant="body-md" as="span">
                {option.label}
              </Text>
            </Choice>
          </CascadeItem>
        ))}
      </CardGrid>
    </Cascade>
  )
}

interface RevealProps {
  answer: string
}

function Reveal({ answer }: RevealProps) {
  const { t } = useTranslation()

  return (
    <Stack direction="row" gap="xs" alignItems="center" justifyContent="center">
      <Icon name="close" size="sm" color="error" variant="solid" />
      <Text variant="label" tone="error" weight="bold" as="span">
        {t('dm.quiz.reveal', { value: answer })}
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
  const { t } = useTranslation()

  return (
    <Stack as="form" gap="sm" onSubmit={onSubmit}>
      <Input
        key={round}
        label={t('dm.quiz.input.label')}
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
        {t('dm.quiz.input.submit')}
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
  const { t } = useTranslation()

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
          {newRecord ? t('dm.quiz.done.record') : t('dm.quiz.done.title')}
        </Heading>
      </Stack>

      <CardGrid minItemWidth="9rem" gap="sm">
        <StatCard
          label={t('dm.quiz.done.score')}
          value={t('dm.quiz.points', { value: score })}
          icon="lightning"
          tone={newRecord ? 'success' : 'neutral'}
        />
        <StatCard
          label={t('dm.quiz.done.correct')}
          value={`${count.ok}`}
          icon="check"
          iconColor="success"
        />
        <StatCard
          label={t('dm.quiz.done.missed')}
          value={`${count.ko}`}
          icon="close"
          iconColor="error"
        />
        <StatCard
          label={t('dm.quiz.done.best')}
          value={t('dm.quiz.points', { value: getBest('quiz') })}
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
        {t('dm.quiz.done.replay')}
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
  const { t } = useTranslation()

  const multiplier = 1 + Math.floor(streak / 3)

  useEffect(() => {
    if (phase !== 'play') return
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
  }, [phase, verdict, answerMode])

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
              <Emphasis template={t(question.promptKey)} value={question.promptValue} />
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
