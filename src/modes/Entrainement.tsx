import { useState } from 'react'
import {
  Button,
  Card,
  CardGrid,
  Choice,
  Heading,
  Icon,
  Lives,
  Pressable,
  Stack,
  Text,
  useCanopSound,
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
    icon: 'tag',
    title: 'Codes',
    desc: 'Associe chaque département à son numéro.',
  },
  {
    id: 'nom',
    icon: 'pencil',
    title: 'Noms',
    desc: 'Quel département se cache derrière ce numéro ?',
  },
  {
    id: 'region',
    icon: 'mapLocation',
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
  return (
    <Stack gap="lg" alignItems="stretch">
      <Stack gap="xs" alignItems="center">
        <Stack direction="row" gap="sm" alignItems="center">
          <Icon name="university" variant="solid" size="md" color="primary" />
          <Heading level={2} align="center" gutterBottom={false}>
            Entraînement ciblé
          </Heading>
        </Stack>
        <Text variant="lead" tone="muted" align="center">
          Choisis un thème et révise-le à fond. Tu as {LIVES} vies : enchaîne les questions tant
          qu'il t'en reste.
        </Text>
        <Lives value={LIVES} max={LIVES} ariaLabel={`${LIVES} vies au départ`} />
      </Stack>

      <CardGrid minItemWidth="15rem" gap="md">
        {THEMES.map((t) => (
          <Pressable
            key={t.id}
            onClick={() => onPick(t.id)}
            padding="lg"
            fullWidth
            ariaLabel={t.title}
          >
            <Stack gap="sm" alignItems="start">
              <Icon name={t.icon} variant="solid" size="lg" color="primary" />
              <Heading level={3} size={4} gutterBottom={false}>
                {t.title}
              </Heading>
              <Text variant="body-sm" tone="muted">
                {t.desc}
              </Text>
            </Stack>
          </Pressable>
        ))}
      </CardGrid>
    </Stack>
  )
}

interface RecapProps {
  results: Result[]
  onReplay: () => void
  onChangeTheme: () => void
}

function Recap({ results, onReplay, onChangeTheme }: RecapProps) {
  const ok = results.filter((r) => r.ok).length

  return (
    <Stack gap="lg" alignItems="stretch">
      <Card variant="floating">
        <Stack gap="xs" alignItems="center">
          <Icon name="star" variant="solid" size="xl" color="warning" />
          <Heading level={2} align="center" gutterBottom={false}>
            Plus de vies !
          </Heading>
          <Text variant="metric" tone="primary">
            {ok}
          </Text>
          <Text variant="body-sm" tone="muted" align="center">
            bonnes réponses sur {results.length} questions tentées
          </Text>
        </Stack>
      </Card>

      <Card title="Récapitulatif">
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
                  title={r.ok ? 'Bonne réponse' : 'Mauvaise réponse'}
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
        <Button onClick={onReplay}>Rejouer ce thème</Button>
        <Button variant="ghost" onClick={onChangeTheme}>
          Changer de thème
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
  const flash: CanopCardFlash | undefined = picked
    ? picked === question.answer
      ? 'success'
      : 'error'
    : undefined

  return (
    <Stack gap="md" alignItems="stretch">
      <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between">
        <Text variant="label" tone="muted">
          Question {index + 1}
        </Text>
        <Lives value={livesLeft} max={LIVES} ariaLabel={`${livesLeft} vies restantes`} />
      </Stack>

      <Card flash={flash}>
        <Stack gap="md" alignItems="stretch">
          <Heading level={3} size={4} align="center" gutterBottom={false}>
            {question.prompt}
          </Heading>
          <Stack gap="sm" alignItems="stretch" role="group" ariaLabel="Réponses proposées">
            {question.options.map((opt) => (
              <Choice
                key={opt}
                state={choiceState(opt, question.answer, picked)}
                disabled={picked !== null}
                onClick={() => onChoose(opt)}
              >
                <Text variant="body-md" as="span">
                  {opt}
                </Text>
              </Choice>
            ))}
          </Stack>
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

  if (!theme) return <ThemePicker onPick={start} />

  if (finished) {
    return (
      <Recap
        results={results}
        onReplay={() => start(theme)}
        onChangeTheme={() => {
          play('click')
          setTheme(null)
        }}
      />
    )
  }

  if (!question) return null

  return (
    <Play
      index={index}
      livesLeft={livesLeft}
      question={question}
      picked={picked}
      onChoose={choose}
    />
  )
}
