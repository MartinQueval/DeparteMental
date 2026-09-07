import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import franceMap from '@svg-maps/france.departments'
import {
  Button,
  Card,
  Heading,
  Icon,
  Legend,
  Stack,
  SvgMap,
  Text,
  useCanopSound,
  useSvgMapViewport,
  type CanopSvgMapRegion,
  type UseSvgMapViewportResult,
} from 'canopui'
import { byCode, shuffle, type Departement } from '../lib/departements.ts'
import { load, recordAnswer, type DeptStats } from '../lib/storage.ts'

const ROUNDS = 10
const IDF_CODES = ['75', '92', '93', '94', '91', '95', '77', '78']
const CORRECT_DELAY = 400
const WRONG_DELAY = 1400
const MAP_MAX_WIDTH = '34rem'

const NEUTRAL = 'var(--canop-palette-background-paper)'
const MASTERED = 'var(--canop-palette-success-main)'
const AVERAGE = 'var(--canop-palette-warning-main)'
const WEAK = 'var(--canop-palette-error-main)'
const REVEALED = 'var(--canop-palette-info-main)'

const PLAIN_REGIONS: CanopSvgMapRegion[] = franceMap.locations.map(({ id, path }) => ({ id, path }))

const NAMED_REGIONS: CanopSvgMapRegion[] = franceMap.locations.map(({ id, path }) => ({
  id,
  path,
  name: `${byCode[id].nom} (${id})`,
}))

const MAP_CODES = PLAIN_REGIONS.map((region) => region.id)

type CarteMode = 'jeu' | 'heatmap'
type CellResult = 'ok' | 'ko' | 'target'

const RESULT_FILL: Record<CellResult, string> = {
  ok: MASTERED,
  ko: WEAK,
  target: REVEALED,
}

function heatFill(code: string, stats: Record<string, DeptStats>): string {
  const stat = stats[code]
  if (!stat) return NEUTRAL
  const rate = stat.ok / stat.seen
  if (rate >= 0.8) return MASTERED
  if (rate >= 0.5) return AVERAGE
  return WEAK
}

function useDelayedStep() {
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  return useCallback((step: () => void, delay: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(step, delay)
  }, [])
}

interface CarteMapProps {
  viewport: UseSvgMapViewportResult
  regions: readonly CanopSvgMapRegion[]
  fill: (id: string) => string
  selectable?: boolean
  onSelect?: (id: string) => void
}

function CarteMap({ viewport, regions, fill, selectable = false, onSelect }: CarteMapProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: MAP_MAX_WIDTH, marginInline: 'auto' }}>
      <SvgMap
        viewBox={franceMap.viewBox}
        viewport={viewport}
        regions={regions}
        fill={fill}
        selectable={selectable}
        onSelect={onSelect}
        ariaLabel="Carte des départements français"
        overlay={
          <Button size="small" variant="secondary" onClick={() => viewport.fitTo(IDF_CODES)}>
            IDF
          </Button>
        }
      />
    </Box>
  )
}

function CarteAide() {
  return (
    <Text variant="caption" tone="muted" align="center">
      Pince pour zoomer · glisse pour te déplacer · « IDF » pour la région parisienne
    </Text>
  )
}

interface CarteSetupProps {
  onChoose: (mode: CarteMode) => void
}

function CarteSetup({ onChoose }: CarteSetupProps) {
  const { play } = useCanopSound()

  return (
    <Card>
      <Stack gap="md" alignItems="stretch">
        <Stack direction="row" gap="sm" alignItems="center">
          <Icon name="mapLocation" size="lg" color="primary" variant="solid" />
          <Heading level={2} size={3} gutterBottom={false}>
            Carte de France
          </Heading>
        </Stack>
        <Stack direction="row" gap="sm" wrap>
          <Button
            startIcon={<Icon name="locationCheck" size="sm" />}
            onClick={() => {
              play('start')
              onChoose('jeu')
            }}
          >
            Jouer ({ROUNDS} départements à localiser)
          </Button>
          <Button
            variant="secondary"
            startIcon={<Icon name="mapLocation" size="sm" />}
            onClick={() => {
              play('click')
              onChoose('heatmap')
            }}
          >
            Ma heatmap de progression
          </Button>
        </Stack>
      </Stack>
    </Card>
  )
}

interface CarteConsigneProps {
  round: number
  score: number
  target: Departement
}

function CarteConsigne({ round, score, target }: CarteConsigneProps) {
  return (
    <Card density="dense">
      <Stack gap="sm" alignItems="stretch">
        <Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
          <Stack direction="row" gap="xs" alignItems="center">
            <Icon name="locationCheck" size="sm" />
            <Text variant="label" tone="muted">
              {round + 1}/{ROUNDS}
            </Text>
          </Stack>
          <Stack direction="row" gap="xs" alignItems="center">
            <Icon name="check" size="sm" color="success" />
            <Text variant="label" weight="bold">
              {score}
            </Text>
          </Stack>
        </Stack>
        <Stack gap="xs" alignItems="center">
          <Text variant="overline" tone="muted">
            Clique sur
          </Text>
          <Heading level={3} size={4} align="center" gutterBottom={false}>
            {target.nom} ({target.code})
          </Heading>
        </Stack>
      </Stack>
    </Card>
  )
}

interface CarteResultatProps {
  score: number
  onRestart: () => void
}

function CarteResultat({ score, onRestart }: CarteResultatProps) {
  return (
    <Card>
      <Stack gap="sm" alignItems="center">
        <Icon name="locationCheck" size="xl" color="accent" variant="solid" />
        <Heading level={3} size={3} align="center" gutterBottom={false}>
          {score} / {ROUNDS}
        </Heading>
        <Text variant="body-sm" tone="muted" align="center">
          départements localisés
        </Text>
        <Button onClick={onRestart}>Rejouer</Button>
      </Stack>
    </Card>
  )
}

interface UseCarteJeuResult {
  viewport: UseSvgMapViewportResult
  round: number
  score: number
  finished: boolean
  target: Departement | null
  fill: (id: string) => string
  answer: (id: string) => void
  restart: () => void
}

function useCarteJeu(): UseCarteJeuResult {
  const { play } = useCanopSound()
  const viewport = useSvgMapViewport({ viewBox: franceMap.viewBox })
  const [queue, setQueue] = useState(() => shuffle(MAP_CODES).slice(0, ROUNDS))
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<Record<string, CellResult>>({})
  const [locked, setLocked] = useState(false)
  const later = useDelayedStep()

  const targetCode = queue[round]

  const answer = useCallback(
    (id: string) => {
      if (locked || round >= ROUNDS) return
      const correct = id === targetCode
      const last = round + 1 >= ROUNDS
      recordAnswer(targetCode, correct)

      if (correct) {
        play('correct')
        setScore((current) => current + 1)
        setResult((current) => ({ ...current, [id]: 'ok' }))
        later(() => {
          setRound((current) => current + 1)
          if (last) play('finish')
        }, CORRECT_DELAY)
        return
      }

      play('wrong')
      setLocked(true)
      setResult((current) => ({ ...current, [id]: 'ko', [targetCode]: 'target' }))
      later(() => {
        setResult((current) => {
          const rest = { ...current }
          delete rest[id]
          delete rest[targetCode]
          return rest
        })
        setLocked(false)
        setRound((current) => current + 1)
        if (last) play('finish')
      }, WRONG_DELAY)
    },
    [later, locked, play, round, targetCode]
  )

  const fill = useCallback(
    (id: string) => {
      const cell = result[id]
      return cell ? RESULT_FILL[cell] : NEUTRAL
    },
    [result]
  )

  const restart = useCallback(() => {
    play('start')
    viewport.reset()
    setQueue(shuffle(MAP_CODES).slice(0, ROUNDS))
    setRound(0)
    setScore(0)
    setResult({})
    setLocked(false)
  }, [play, viewport])

  return {
    viewport,
    round,
    score,
    finished: round >= ROUNDS,
    target: targetCode ? byCode[targetCode] : null,
    fill,
    answer,
    restart,
  }
}

function CarteJeu() {
  const { viewport, round, score, finished, target, fill, answer, restart } = useCarteJeu()

  return (
    <Stack gap="md" alignItems="stretch">
      {finished && <CarteResultat score={score} onRestart={restart} />}
      {!finished && target && <CarteConsigne round={round} score={score} target={target} />}
      <CarteMap
        viewport={viewport}
        regions={PLAIN_REGIONS}
        fill={fill}
        selectable={!finished}
        onSelect={answer}
      />
      <CarteAide />
    </Stack>
  )
}

function CarteHeatmap() {
  const viewport = useSvgMapViewport({ viewBox: franceMap.viewBox })
  const [stats] = useState(() => load().stats)
  const fill = useCallback((id: string) => heatFill(id, stats), [stats])

  return (
    <Stack gap="md" alignItems="stretch">
      <Card density="dense">
        <Legend
          items={[
            { tone: 'success', label: 'maîtrisé' },
            { tone: 'warning', label: 'moyen' },
            { tone: 'error', label: 'à bosser' },
            { tone: 'neutral', label: 'jamais croisé' },
          ]}
        />
      </Card>
      <CarteMap viewport={viewport} regions={NAMED_REGIONS} fill={fill} />
      <CarteAide />
    </Stack>
  )
}

export default function Carte() {
  const [mode, setMode] = useState<CarteMode | null>(null)

  if (!mode) return <CarteSetup onChoose={setMode} />
  if (mode === 'jeu') return <CarteJeu />
  return <CarteHeatmap />
}
