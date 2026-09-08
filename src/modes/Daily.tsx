import { useMemo, useState, type FormEvent } from 'react'
import {
  Autocomplete,
  Button,
  Card,
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
  type CanopAutocompleteOption,
  type CanopCardFlash,
  type CanopDescriptionItem,
  type CanopIconName,
  type CanopShareTone,
} from 'canopui'
import {
  byCode,
  codeValue,
  departements,
  normalize,
  type Departement,
} from '../lib/departements.ts'
import { Cascade, CascadeItem, ViewIn } from '../lib/motion.tsx'
import { getDaily, setDaily, recordAnswer, type DailyState } from '../lib/storage.ts'

const MAX_GUESSES = 6
const FLASH_DURATION = 1200
const NEAR_CODE_DISTANCE = 10

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
  return departements[Math.abs(h) % departements.length]
}

interface Hint {
  icon: CanopIconName | null
  label: string
  value: string
}

function hints(target: Departement, wrongCount: number): Hint[] {
  const all: Hint[] = [
    { icon: 'location', label: 'Région', value: target.region },
    { icon: 'pencil', label: 'Première lettre du nom', value: `« ${target.nom[0]} »` },
    { icon: null, label: 'Longueur du nom', value: `${target.nom.length} caractères` },
    {
      icon: 'bank',
      label: 'Première lettre de la préfecture',
      value: `« ${target.prefecture[0]} »`,
    },
    { icon: 'bank', label: 'Préfecture', value: target.prefecture },
  ]
  return all.slice(0, wrongCount)
}

function hintItems(target: Departement, wrongCount: number): CanopDescriptionItem[] {
  return hints(target, wrongCount).map(({ icon, label, value }) => ({
    label,
    value: (
      <Stack direction="row" gap="xs" alignItems="center">
        {icon && <Icon name={icon} size="sm" color="primary" />}
        <Text variant="body-sm">{value}</Text>
      </Stack>
    ),
  }))
}

function resultItems(target: Departement): CanopDescriptionItem[] {
  const items: CanopDescriptionItem[] = [{ label: 'Préfecture', value: target.prefecture }]
  if (target.sousPrefectures.length > 0) {
    items.push({ label: 'Sous-préfectures', value: target.sousPrefectures.join(', ') })
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
              {exact ? 'code exact' : codeDiff > 0 ? 'n° plus grand' : 'n° plus petit'}
            </Text>
          </Stack>
          <Stack direction="row" gap="xs" alignItems="center">
            <Icon
              name={sameRegion ? 'check' : 'close'}
              size="sm"
              color={sameRegion ? 'success' : 'error'}
            />
            <Text variant="body-sm" tone="muted">
              région
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
  const last = guesses.length - 1

  return (
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
  )
}

interface DailyResultProps {
  state: DailyState
  target: Departement
  dateKey: string
}

function DailyResult({ state, target, dateKey }: DailyResultProps) {
  const rows = useMemo(() => shareRows(state.guesses, target), [state.guesses, target])

  return (
    <Stack gap="md">
      <Card tone={state.won ? 'success' : 'error'}>
        <Stack gap="xs" alignItems="center">
          {state.won ? (
            <>
              <Stack direction="row" gap="xs" alignItems="center">
                <Icon name="star" size="md" color="accent" variant="solid" />
                <Heading level={3} size={3} gutterBottom={false}>
                  Bravo !
                </Heading>
              </Stack>
              <Text variant="metric">
                {state.guesses.length}/{MAX_GUESSES}
              </Text>
            </>
          ) : (
            <>
              <Heading level={3} size={3} gutterBottom={false}>
                Raté !
              </Heading>
              <Text>
                C’était{' '}
                <Text as="span" weight="bold">
                  {target.nom} ({target.code})
                </Text>
              </Text>
            </>
          )}
        </Stack>
      </Card>

      <Card title="Le département du jour" density="dense">
        <DescriptionList items={resultItems(target)} />
      </Card>

      <ShareResult rows={rows} text={shareText(rows, state, dateKey)} />

      <Text variant="body-sm" tone="muted">
        Reviens demain pour un nouveau département !
      </Text>
    </Stack>
  )
}

export default function Daily() {
  const dateKey = todayKey()
  const target = useMemo(() => dailyDept(dateKey), [dateKey])
  const [state, setState] = useState<DailyState>(
    () => getDaily(dateKey) ?? { guesses: [], done: false, won: false }
  )
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const { play } = useCanopSound()
  const { value: flash, show: showFlash } = useTransientState<CanopCardFlash | undefined>(
    undefined,
    { duration: FLASH_DURATION }
  )

  const options = useMemo<CanopAutocompleteOption[]>(
    () => departements.map((d) => ({ value: d.code, label: d.nom })),
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
      setError('Département inconnu — choisis dans la liste !')
      return
    }
    if (state.guesses.includes(found.code)) {
      setError('Déjà essayé !')
      return
    }
    setError('')
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

  const wrongCount = state.guesses.filter((c) => c !== target.code).length

  return (
    <ViewIn>
      <Stack gap="lg">
        <Stack gap="xs">
          <Stack direction="row" gap="xs" alignItems="center">
            <Icon name="calendar" size="md" color="primary" />
            <Heading level={2} gutterBottom={false}>
              Défi du jour
            </Heading>
          </Stack>
          <Text tone="muted">Devine le département mystère en {MAX_GUESSES} essais max.</Text>
        </Stack>

        {wrongCount > 0 && (
          <Card title="Indices" density="dense">
            <DescriptionList items={hintItems(target, Math.min(wrongCount, 5))} />
          </Card>
        )}

        {state.guesses.length > 0 && (
          <GuessList guesses={state.guesses} target={target} flash={flash} />
        )}

        {state.done ? (
          <DailyResult state={state} target={target} dateKey={dateKey} />
        ) : (
          <Stack as="form" gap="sm" onSubmit={submit}>
            <Autocomplete
              options={options}
              value={code}
              onChange={setCode}
              inputValue={input}
              onInputChange={changeInput}
              normalize={tolerant}
              ariaLabel="Département"
              placeholder={`Essai ${state.guesses.length + 1}/${MAX_GUESSES}…`}
              fullWidth
            />
            <Button type="submit" fullWidth>
              Deviner
            </Button>
            <Feedback severity="error" onClose={() => setError('')}>
              {error}
            </Feedback>
          </Stack>
        )}
      </Stack>
    </ViewIn>
  )
}
