import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Choice,
  Heading,
  Icon,
  Lives,
  Stack,
  Text,
  useCanopSound,
  useTranslation,
  type CanopCardFlash,
  type CanopChoiceState,
  type CanopIconName,
} from 'canopui'
import {
  byCode,
  departements,
  distractors,
  pickRandom,
  shuffle,
  type Departement,
} from '../lib/departements.ts'
import { ModeHeader } from '../lib/modeHeader.tsx'
import { Cascade, CascadeItem, ViewIn } from '../lib/motion.tsx'
import { usePlural } from '../lib/plural.ts'
import { TileGrid, type TileModel } from '../lib/tiles.tsx'
import { useDelayedStep } from '../lib/useDelayedStep.ts'
import { pickWeighted, recordAnswer } from '../lib/storage.ts'

const LIVES = 10

type ThemeId = 'prefecture' | 'souspref' | 'code' | 'nom' | 'region'

interface ThemeDefinition {
  id: ThemeId
  icon: CanopIconName
}

const THEMES: readonly ThemeDefinition[] = [
  { id: 'prefecture', icon: 'bank' },
  { id: 'souspref', icon: 'location' },
  { id: 'code', icon: 'tag' },
  { id: 'nom', icon: 'pencil' },
  { id: 'region', icon: 'mapLocation' },
]

function useThemeTiles(): TileModel<ThemeId>[] {
  const { t } = useTranslation()

  return useMemo<TileModel<ThemeId>[]>(
    () =>
      THEMES.map(({ id, icon }) => ({
        id,
        icon,
        title: t(`dm.training.theme.${id}.title`),
        desc: t(`dm.training.theme.${id}.desc`),
      })),
    [t]
  )
}

interface Question {
  dept: Departement
  promptKey: string
  promptValue: string
  answer: string
  options: string[]
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
      promptKey: 'dm.training.prompt.souspref',
      promptValue: `${dept.nom} (${dept.code})`,
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
      promptKey: 'dm.training.prompt.prefecture',
      promptValue: `${dept.nom} (${dept.code})`,
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
      promptKey: 'dm.training.prompt.code',
      promptValue: dept.nom,
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
      promptKey: 'dm.training.prompt.nom',
      promptValue: dept.code,
      answer: dept.nom,
      options: buildOptions(
        dept.nom,
        near.map((d) => d.nom),
        departements.map((d) => d.nom),
      ),
    }
  }

  return {
    dept,
    promptKey: 'dm.training.prompt.region',
    promptValue: `${dept.nom} (${dept.code})`,
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

function choiceState(option: string, answer: string, picked: string | null): CanopChoiceState {
  if (!picked) return 'neutral'
  if (option === answer) return 'correct'
  if (option === picked) return 'incorrect'
  return 'neutral'
}

interface ThemePickerProps {
  onPick: (id: ThemeId) => void
}

function ThemePicker({ onPick }: ThemePickerProps) {
  const { t } = useTranslation()
  const tiles = useThemeTiles()

  return (
    <Stack gap="lg" alignItems="stretch">
      <ModeHeader
        icon="university"
        title={t('dm.training.title')}
        description={t('dm.training.intro', { lives: LIVES })}
      >
        <Lives
          value={LIVES}
          max={LIVES}
          ariaLabel={t('dm.training.startingLives', { lives: LIVES })}
        />
      </ModeHeader>

      <TileGrid tiles={tiles} onPick={onPick} />
    </Stack>
  )
}

interface RecapProps {
  results: Result[]
  onReplay: () => void
  onChangeTheme: () => void
}

function Recap({ results, onReplay, onChangeTheme }: RecapProps) {
  const { t } = useTranslation()
  const plural = usePlural()
  const ok = results.filter((r) => r.ok).length

  return (
    <Stack gap="lg" alignItems="stretch">
      <Card variant="floating">
        <Stack gap="xs" alignItems="center">
          <Icon name="star" variant="solid" size="xl" color="warning" />
          <Heading level={2} align="center" gutterBottom={false}>
            {t('dm.training.recap.title')}
          </Heading>
          <Text variant="metric" tone="primary">
            {ok}
          </Text>
          <Text variant="body-sm" tone="muted" align="center">
            {plural('dm.training.recap.summary', ok, { total: results.length })}
          </Text>
        </Stack>
      </Card>

      <Card title={t('dm.training.recap.list')}>
        <Stack gap="xs" role="list">
          {results.map((r, i) => {
            const d = byCode[r.code]
            return (
              <Stack
                key={`${r.code}-${i}`}
                direction="row"
                gap="sm"
                alignItems="center"
                role="listitem"
              >
                <Icon
                  name={r.ok ? 'check' : 'close'}
                  variant="solid"
                  size="sm"
                  color={r.ok ? 'success' : 'error'}
                  title={r.ok ? t('dm.answer.correct') : t('dm.answer.incorrect')}
                />
                <Text variant="body-sm">
                  {d.code} — {d.nom}
                </Text>
              </Stack>
            )
          })}
        </Stack>
      </Card>

      <Stack direction="row" gap="sm" justifyContent="center" wrap>
        <Button onClick={onReplay}>{t('dm.training.recap.replay')}</Button>
        <Button variant="ghost" onClick={onChangeTheme}>
          {t('dm.training.recap.changeTheme')}
        </Button>
      </Stack>
    </Stack>
  )
}

interface PlayProps {
  index: number
  livesLeft: number
  question: Question
  picked: string | null
  onChoose: (option: string) => void
}

function Play({ index, livesLeft, question, picked, onChoose }: PlayProps) {
  const { t } = useTranslation()
  const plural = usePlural()
  const flash: CanopCardFlash | undefined = picked
    ? picked === question.answer
      ? 'success'
      : 'error'
    : undefined

  return (
    <Stack gap="md" alignItems="stretch">
      <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between">
        <Text variant="body-lg" weight="semibold" tabularNums as="span">
          {t('dm.training.question', { value: index + 1 })}
        </Text>
        <Lives
          value={livesLeft}
          max={LIVES}
          ariaLabel={plural('dm.training.livesLeft', livesLeft)}
        />
      </Stack>

      <Card flash={flash}>
        <Stack gap="md" alignItems="stretch">
          <Heading level={3} size={4} align="center" gutterBottom={false}>
            {t(question.promptKey, { value: question.promptValue })}
          </Heading>
          <Cascade key={index}>
            <Stack
              gap="sm"
              alignItems="stretch"
              role="group"
              ariaLabel={t('dm.training.answers')}
            >
              {question.options.map((opt) => (
                <CascadeItem key={opt}>
                  <Choice
                    state={choiceState(opt, question.answer, picked)}
                    disabled={picked !== null}
                    onClick={() => onChoose(opt)}
                  >
                    <Text variant="body-md" as="span">
                      {opt}
                    </Text>
                  </Choice>
                </CascadeItem>
              ))}
            </Stack>
          </Cascade>
        </Stack>
      </Card>
    </Stack>
  )
}

export default function Entrainement() {
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [finished, setFinished] = useState(false)
  const { play } = useCanopSound()
  const later = useDelayedStep()

  const lostLives = results.filter((r) => !r.ok).length
  const livesLeft = Math.max(0, LIVES - lostLives)

  function start(id: ThemeId) {
    play('start')
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

    const gameOver = lostLives + (ok ? 0 : 1) >= LIVES
    later(
      () => {
        if (gameOver) {
          play('finish')
          setFinished(true)
          return
        }
        setIndex((i) => i + 1)
        setPicked(null)
        setQuestion(makeQuestion(theme))
      },
      ok ? 600 : 1100
    )
  }

  if (!theme) {
    return (
      <ViewIn key="themes">
        <ThemePicker onPick={start} />
      </ViewIn>
    )
  }

  if (finished) {
    return (
      <ViewIn key="recap">
        <Recap
          results={results}
          onReplay={() => start(theme)}
          onChangeTheme={() => {
            play('click')
            setTheme(null)
          }}
        />
      </ViewIn>
    )
  }

  if (!question) return null

  return (
    <ViewIn key="play">
      <Play
        index={index}
        livesLeft={livesLeft}
        question={question}
        picked={picked}
        onChoose={choose}
      />
    </ViewIn>
  )
}
