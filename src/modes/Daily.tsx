import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Autocomplete,
  Button,
  Card,
  CardGrid,
  DescriptionList,
  Feedback,
  foldForSearch,
  Heading,
  Icon,
  ShareResult,
  Stack,
  Text,
  useCanopSound,
  useTransientState,
  useTranslation,
  type CanopAutocompleteOption,
  type CanopCardFlash,
  type CanopDescriptionItem,
  type CanopIconName,
  type CanopShareTone,
  type CanopTranslate,
} from 'canopui'
import {
  byCode,
  codeValue,
  metropole,
  normalize,
  type Departement,
} from '../lib/departements.ts'
import { Emphasis } from '../lib/emphasis.tsx'
import { ModeHeader } from '../lib/modeHeader.tsx'
import { Cascade, CascadeItem, ViewIn } from '../lib/motion.tsx'
import { getDaily, setDaily, recordAnswer, type DailyState } from '../lib/storage.ts'

const MAX_GUESSES = 6
const FLASH_DURATION = 1200
const NEAR_CODE_DISTANCE = 10
const BOARD_MIN_COLUMN_WIDTH = '22rem'

const toneEmoji: Record<CanopShareTone, string> = {
  hit: '🟩',
  near: '🟨',
  miss: '⬛',
}

function tolerant(text: string): string {
  return foldForSearch(text).replace(/\bst\b/g, 'saint')
}

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
  return metropole[Math.abs(h) % metropole.length]
}

interface Hint {
  icon: CanopIconName | null
  label: string
  value: string
}

function hintList(target: Departement, t: CanopTranslate): Hint[] {
  return [
    { icon: 'location', label: t('dm.daily.field.region'), value: target.region },
    {
      icon: 'pencil',
      label: t('dm.daily.field.firstLetter'),
      value: t('dm.daily.quoted', { value: target.nom[0] }),
    },
    {
      icon: null,
      label: t('dm.daily.field.nameLength'),
      value: t('dm.daily.nameLengthValue', { count: target.nom.length }),
    },
    {
      icon: 'bank',
      label: t('dm.daily.field.prefectureFirstLetter'),
      value: t('dm.daily.quoted', { value: target.prefecture[0] }),
    },
    { icon: 'bank', label: t('dm.daily.field.prefecture'), value: target.prefecture },
  ]
}

interface RevealedHints {
  latest?: Hint
  previous: Hint[]
  revealed: number
  total: number
}

function useRevealedHints(target: Departement, wrongCount: number): RevealedHints {
  const { t } = useTranslation()

  return useMemo(() => {
    const all = hintList(target, t)
    const revealed = all.slice(0, wrongCount)
    return {
      latest: revealed[revealed.length - 1],
      previous: revealed.slice(0, -1),
      revealed: revealed.length,
      total: all.length,
    }
  }, [target, t, wrongCount])
}

interface HintValueProps {
  hint: Hint
  emphasis?: boolean
}

function HintValue({ hint, emphasis = false }: HintValueProps) {
  return (
    <Stack direction="row" gap="xs" alignItems="center" wrap>
      {hint.icon && (
        <Icon
          name={hint.icon}
          size="sm"
          color="primary"
          variant={emphasis ? 'solid' : 'outline'}
        />
      )}
      <Text
        variant={emphasis ? 'body-md' : 'body-sm'}
        weight={emphasis ? 'semibold' : undefined}
      >
        {hint.value}
      </Text>
    </Stack>
  )
}

interface LatestHintProps {
  hint: Hint
  revealed: number
  total: number
}

function LatestHint({ hint, revealed, total }: LatestHintProps) {
  const { t } = useTranslation()

  return (
    <Card variant="stat" radius="lg" density="dense">
      <Stack gap="xs">
        <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between">
          <Stack direction="row" gap="xs" alignItems="center">
            <Icon name="lightbulb" size="sm" color="primary" variant="solid" />
            <Text variant="overline" tone="muted" as="span">
              {t('dm.daily.hint.latest')}
            </Text>
          </Stack>
          <Text variant="caption" tone="muted" tabularNums as="span">
            {revealed}/{total}
          </Text>
        </Stack>
        <Text variant="caption" tone="muted" as="span">
          {hint.label}
        </Text>
        <HintValue hint={hint} emphasis />
      </Stack>
    </Card>
  )
}

interface PreviousHintsProps {
  hints: Hint[]
}

function PreviousHints({ hints }: PreviousHintsProps) {
  const { t } = useTranslation()
  const items: CanopDescriptionItem[] = hints.map((hint) => ({
    label: hint.label,
    value: <HintValue hint={hint} />,
  }))

  return (
    <Card title={t('dm.daily.hint.previous')} density="dense">
      <DescriptionList items={items} />
    </Card>
  )
}

function resultItems(target: Departement, t: CanopTranslate): CanopDescriptionItem[] {
  const items: CanopDescriptionItem[] = [
    { label: t('dm.daily.field.prefecture'), value: target.prefecture },
  ]
  if (target.sousPrefectures.length > 0) {
    items.push({
      label: t('dm.daily.field.subPrefectures'),
      value: target.sousPrefectures.join(', '),
    })
  }
  return items
}

function shareRows(guesses: string[], target: Departement): CanopShareTone[][] {
  return guesses.map((code) => {
    if (code === target.code) return ['hit', 'hit']
    const d = byCode[code]
    return [
      d.region === target.region ? 'near' : 'miss',
      Math.abs(codeValue(d.code) - codeValue(target.code)) <= NEAR_CODE_DISTANCE
        ? 'near'
        : 'miss',
    ]
  })
}

function shareText(rows: CanopShareTone[][], state: DailyState, dateKey: string): string {
  const grid = rows.map((row) => row.map((tone) => toneEmoji[tone]).join('')).join('\n')
  const score = state.won ? state.guesses.length : 'X'
  return `DéparteMental ${dateKey} — ${score}/${MAX_GUESSES}\n${grid}`
}

interface GuessRowProps {
  guess: string
  target: Departement
  flash?: CanopCardFlash
}

function GuessRow({ guess, target, flash }: GuessRowProps) {
  const { t } = useTranslation()
  const d = byCode[guess]
  const exact = d.code === target.code
  const sameRegion = d.region === target.region
  const codeDiff = codeValue(target.code) - codeValue(d.code)

  return (
    <Card density="dense" radius="md" tone={exact ? 'success' : 'neutral'} flash={flash}>
      <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between" wrap>
        <Text weight="semibold">{d.nom}</Text>
        <Stack direction="row" gap="md" alignItems="center" wrap>
          <Stack direction="row" gap="xs" alignItems="center">
            {exact ? (
              <Icon name="locationCheck" size="sm" color="success" />
            ) : (
              <Icon name={codeDiff > 0 ? 'arrowUp' : 'arrowDown'} size="sm" />
            )}
            <Text variant="body-sm" tone="muted">
              {exact
                ? t('dm.daily.guess.exact')
                : codeDiff > 0
                  ? t('dm.daily.guess.higher')
                  : t('dm.daily.guess.lower')}
            </Text>
          </Stack>
          <Stack direction="row" gap="xs" alignItems="center">
            <Icon
              name={sameRegion ? 'check' : 'close'}
              size="sm"
              color={sameRegion ? 'success' : 'error'}
            />
            <Text variant="body-sm" tone="muted">
              {t('dm.daily.guess.region')}
            </Text>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  )
}

interface GuessListProps {
  guesses: string[]
  target: Departement
  flash?: CanopCardFlash
}

function GuessList({ guesses, target, flash }: GuessListProps) {
  const { t } = useTranslation()
  const last = guesses.length - 1

  return (
    <Stack gap="xs">
      <Text variant="overline" tone="muted" as="span">
        {t('dm.daily.history')}
      </Text>
      <Cascade>
        <Stack gap="xs">
          {guesses.map((guess, index) => (
            <CascadeItem key={guess}>
              <GuessRow
                guess={guess}
                target={target}
                flash={index === last ? flash : undefined}
              />
            </CascadeItem>
          ))}
        </Stack>
      </Cascade>
    </Stack>
  )
}

interface DailyFormProps {
  options: CanopAutocompleteOption[]
  code: string
  input: string
  attempt: number
  errorKey: string
  onCodeChange: (value: string) => void
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onDismissError: () => void
}

function DailyForm({
  options,
  code,
  input,
  attempt,
  errorKey,
  onCodeChange,
  onInputChange,
  onSubmit,
  onDismissError,
}: DailyFormProps) {
  const { t } = useTranslation()

  return (
    <Stack as="form" gap="sm" onSubmit={onSubmit}>
      <Autocomplete
        options={options}
        value={code}
        onChange={onCodeChange}
        inputValue={input}
        onInputChange={onInputChange}
        normalize={tolerant}
        ariaLabel={t('dm.daily.input.label')}
        placeholder={t('dm.daily.input.placeholder', { current: attempt, max: MAX_GUESSES })}
        fullWidth
      />
      <Button type="submit" fullWidth>
        {t('dm.daily.input.submit')}
      </Button>
      <Feedback severity="error" onClose={onDismissError}>
        {errorKey && t(errorKey)}
      </Feedback>
    </Stack>
  )
}

interface DailyOutcomeProps {
  state: DailyState
  target: Departement
  dateKey: string
}

function DailyOutcome({ state, target, dateKey }: DailyOutcomeProps) {
  const { t } = useTranslation()
  const rows = useMemo(() => shareRows(state.guesses, target), [state.guesses, target])
  const answer = `${target.nom} (${target.code})`

  return (
    <Card tone={state.won ? 'success' : 'error'} radius="xl">
      <Stack gap="md" alignItems="center">
        <Stack gap="xs" alignItems="center">
          <Icon
            name={state.won ? 'star' : 'location'}
            size="lg"
            variant="solid"
            color={state.won ? 'accent' : 'error'}
          />
          <Heading level={3} size={4} align="center" gutterBottom={false}>
            {state.won ? t('dm.daily.won') : t('dm.daily.lost')}
          </Heading>
          {state.won ? (
            <Heading level={4} size={3} align="center" gutterBottom={false}>
              {answer}
            </Heading>
          ) : (
            <Text variant="lead" align="center">
              <Emphasis template={t('dm.daily.answerWas')} value={answer} />
            </Text>
          )}
          <Text variant="metric">
            {state.guesses.length}/{MAX_GUESSES}
          </Text>
        </Stack>
        <ShareResult rows={rows} text={shareText(rows, state, dateKey)} />
      </Stack>
    </Card>
  )
}

interface DailyDetailsProps {
  target: Departement
}

function DailyDetails({ target }: DailyDetailsProps) {
  const { t } = useTranslation()

  return (
    <Card title={t('dm.daily.result.title')} density="dense">
      <DescriptionList items={resultItems(target, t)} />
    </Card>
  )
}

interface DailyBoardProps {
  primary: ReactNode
  secondary?: ReactNode
}

function DailyBoard({ primary, secondary }: DailyBoardProps) {
  return (
    <CardGrid minItemWidth={BOARD_MIN_COLUMN_WIDTH} gap="md">
      <Stack gap="md">{primary}</Stack>
      {secondary ? <Stack gap="md">{secondary}</Stack> : null}
    </CardGrid>
  )
}

interface UseDailyResult {
  dateKey: string
  target: Departement
  state: DailyState
  code: string
  input: string
  errorKey: string
  flash: CanopCardFlash | undefined
  options: CanopAutocompleteOption[]
  wrongCount: number
  pickCode: (value: string) => void
  changeInput: (text: string) => void
  submit: (event: FormEvent) => void
  dismissError: () => void
}

function useDaily(): UseDailyResult {
  const dateKey = todayKey()
  const target = useMemo(() => dailyDept(dateKey), [dateKey])
  const [state, setState] = useState<DailyState>(
    () => getDaily(dateKey) ?? { guesses: [], done: false, won: false }
  )
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const { play } = useCanopSound()
  const { value: flash, show: showFlash } = useTransientState<CanopCardFlash | undefined>(
    undefined,
    { duration: FLASH_DURATION }
  )

  const options = useMemo<CanopAutocompleteOption[]>(
    () => metropole.map((d) => ({ value: d.code, label: d.nom })),
    []
  )

  function changeInput(text: string) {
    setInput(text)
    if (code && normalize(text) !== normalize(byCode[code].nom)) setCode('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const found = code ? byCode[code] : undefined
    if (!found) {
      setErrorKey('dm.daily.error.unknown')
      return
    }
    if (state.guesses.includes(found.code)) {
      setErrorKey('dm.daily.error.duplicate')
      return
    }
    setErrorKey('')
    setCode('')
    setInput('')
    const guesses = [...state.guesses, found.code]
    const won = found.code === target.code
    const done = won || guesses.length >= MAX_GUESSES
    if (done) recordAnswer(target.code, won)
    play(won ? 'finish' : done ? 'wrong' : 'click')
    showFlash(won ? 'success' : 'error')
    const next: DailyState = { guesses, done, won }
    setState(next)
    setDaily(dateKey, next)
  }

  return {
    dateKey,
    target,
    state,
    code,
    input,
    errorKey,
    flash,
    options,
    wrongCount: state.guesses.filter((c) => c !== target.code).length,
    pickCode: setCode,
    changeInput,
    submit,
    dismissError: () => setErrorKey(''),
  }
}

export default function Daily() {
  const { t } = useTranslation()
  const {
    dateKey,
    target,
    state,
    code,
    input,
    errorKey,
    flash,
    options,
    wrongCount,
    pickCode,
    changeInput,
    submit,
    dismissError,
  } = useDaily()
  const { latest, previous, revealed, total } = useRevealedHints(target, wrongCount)
  const played = state.guesses.length > 0

  return (
    <ViewIn>
      <Stack gap="lg">
        <ModeHeader
          icon="calendar"
          title={t('dm.mode.daily.title')}
          description={t('dm.daily.instructions', { max: MAX_GUESSES })}
          denseOnMobile
        />

        {state.done ? (
          <DailyBoard
            primary={<DailyOutcome state={state} target={target} dateKey={dateKey} />}
            secondary={
              <>
                <DailyDetails target={target} />
                <GuessList guesses={state.guesses} target={target} flash={flash} />
                <Text variant="body-sm" tone="muted" align="center">
                  {t('dm.daily.comeBack')}
                </Text>
              </>
            }
          />
        ) : (
          <DailyBoard
            primary={
              <>
                <DailyForm
                  options={options}
                  code={code}
                  input={input}
                  attempt={state.guesses.length + 1}
                  errorKey={errorKey}
                  onCodeChange={pickCode}
                  onInputChange={changeInput}
                  onSubmit={submit}
                  onDismissError={dismissError}
                />
                {latest && <LatestHint hint={latest} revealed={revealed} total={total} />}
              </>
            }
            secondary={
              played ? (
                <>
                  {previous.length > 0 && <PreviousHints hints={previous} />}
                  <GuessList guesses={state.guesses} target={target} flash={flash} />
                </>
              ) : null
            }
          />
        )}
      </Stack>
    </ViewIn>
  )
}
