import { useCallback, useState, type ReactNode } from 'react'
import franceMap from '@svg-maps/france.departments'
import {
  Button,
  Card,
  Heading,
  Icon,
  Legend,
  ProgressBar,
  Stack,
  SvgMap,
  Text,
  useBreakpointDown,
  useCanopSound,
  useSvgMapViewport,
  useTransientState,
  useTranslation,
  type CanopCardFlash,
  type CanopSvgMapRegion,
  type UseSvgMapViewportResult,
} from 'canopui'
import { byCode, shuffle, type Departement } from '../lib/departements.ts'
import { ViewIn } from '../lib/motion.tsx'
import { useDelayedStep } from '../lib/useDelayedStep.ts'
import { load, recordAnswer, type DeptStats } from '../lib/storage.ts'

const ROUNDS = 10
const CORRECT_DELAY = 400
const WRONG_DELAY = 1400
const MAP_MAX_WIDTH = '34rem'
const MAP_MAX_HEIGHT = '26rem'
const MAP_WEIGHT = 2
const PANEL_WEIGHT = 1
const PROGRESS_SCALE = 100

const NEUTRAL = 'var(--canop-palette-background-paper)'
const MASTERED = 'var(--canop-palette-success-main)'
const AVERAGE = 'var(--canop-palette-warning-main)'
const WEAK = 'var(--canop-palette-error-main)'
const REVEALED = 'var(--canop-palette-info-main)'
const OUTLINE = 'var(--canop-palette-text-disabled)'

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

interface CarteMapProps {
  viewport: UseSvgMapViewportResult
  regions: readonly CanopSvgMapRegion[]
  fill: (id: string) => string
  selectable?: boolean
  onSelect?: (id: string) => void
}

function CarteMap({ viewport, regions, fill, selectable = false, onSelect }: CarteMapProps) {
  const { t } = useTranslation()

  return (
    <Card radius="xl" density="dense" fill>
      <Stack justifyContent="center" fill>
        <SvgMap
          viewBox={franceMap.viewBox}
          viewport={viewport}
          regions={regions}
          fill={fill}
          stroke={OUTLINE}
          maxWidth={MAP_MAX_WIDTH}
          maxHeight={MAP_MAX_HEIGHT}
          selectable={selectable}
          onSelect={onSelect}
          ariaLabel={t('dm.carte.mapLabel')}
        />
      </Stack>
    </Card>
  )
}

function CarteAide() {
  const { t } = useTranslation()

  return (
    <Stack direction="row" gap="xs" alignItems="center" justifyContent="center" wrap>
      <Icon name="info" size="sm" color="neutral" />
      <Text variant="caption" tone="muted" align="center" as="span">
        {t('dm.carte.hint')}
      </Text>
    </Stack>
  )
}

interface CarteBoardProps {
  panel: ReactNode
  map: ReactNode
}

function CarteColumns({ panel, map }: CarteBoardProps) {
  return (
    <Stack direction="row" gap="md" alignItems="stretch">
      <Stack weight={PANEL_WEIGHT}>{panel}</Stack>
      <Stack weight={MAP_WEIGHT}>{map}</Stack>
    </Stack>
  )
}

function CarteRows({ panel, map }: CarteBoardProps) {
  return (
    <Stack gap="md" alignItems="stretch">
      {panel}
      {map}
    </Stack>
  )
}

function CarteBoard({ panel, map }: CarteBoardProps) {
  const stacked = useBreakpointDown('sm')

  return (
    <Stack gap="sm" alignItems="stretch">
      {stacked ? <CarteRows panel={panel} map={map} /> : <CarteColumns panel={panel} map={map} />}
      <CarteAide />
    </Stack>
  )
}

interface CarteSetupProps {
  onChoose: (mode: CarteMode) => void
}

function CarteSetup({ onChoose }: CarteSetupProps) {
  const { play } = useCanopSound()
  const { t } = useTranslation()
  const compact = useBreakpointDown('sm')

  return (
    <Card radius="xl">
      <Stack gap="lg" alignItems="stretch">
        <Stack gap="xs" alignItems="center">
          <Icon name="mapLocation" size="xl" color="primary" variant="solid" />
          <Heading level={2} size={compact ? 4 : 3} align="center" gutterBottom={false}>
            {t('dm.carte.title')}
          </Heading>
          <Text variant="lead" tone="muted" align="center">
            {t('dm.carte.intro')}
          </Text>
        </Stack>
        <Stack direction="row" gap="sm" justifyContent="center" alignItems="center" wrap>
          <Button
            size="large"
            startIcon={<Icon name="locationCheck" size="sm" />}
            onClick={() => {
              play('start')
              onChoose('jeu')
            }}
          >
            {t('dm.carte.play', { count: ROUNDS })}
          </Button>
          <Button
            variant="secondary"
            size="large"
            startIcon={<Icon name="mapLocation" size="sm" />}
            onClick={() => {
              play('click')
              onChoose('heatmap')
            }}
          >
            {t('dm.carte.heatmap')}
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
  flash?: CanopCardFlash
}

function CarteConsigne({ round, score, target, flash }: CarteConsigneProps) {
  const { t } = useTranslation()
  const compact = useBreakpointDown('sm')

  return (
    <Card radius="xl" flash={flash} fill>
      <Stack gap="lg" alignItems="stretch" justifyContent="center" fill>
        <Stack gap="xs" alignItems="stretch">
          <Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
            <Text variant="label" tone="muted" tabularNums as="span">
              {round + 1}/{ROUNDS}
            </Text>
            <Stack direction="row" gap="xs" alignItems="center">
              <Icon name="check" size="sm" color="success" variant="solid" />
              <Text variant="label" weight="bold" tabularNums as="span">
                {score}
              </Text>
            </Stack>
          </Stack>
          <ProgressBar
            value={(round / ROUNDS) * PROGRESS_SCALE}
            ariaLabel={t('dm.carte.progress', { value: round + 1, max: ROUNDS })}
          />
        </Stack>

        <Stack gap="xs" alignItems="center">
          <Text variant="overline" tone="muted" as="span">
            {t('dm.carte.clickOn')}
          </Text>
          <Heading level={3} size={compact ? 5 : 4} align="center" gutterBottom={false}>
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
  const { t } = useTranslation()

  return (
    <Card variant="floating" radius="xl" fill>
      <Stack gap="sm" alignItems="center" justifyContent="center" fill>
        <Icon name="locationCheck" size="xl" color="accent" variant="solid" />
        <Heading level={3} size={2} align="center" gutterBottom={false}>
          {score} / {ROUNDS}
        </Heading>
        <Text variant="body-sm" tone="muted" align="center">
          {t('dm.carte.located')}
        </Text>
        <Button onClick={onRestart} startIcon={<Icon name="refresh" size="sm" />}>
          {t('dm.carte.replay')}
        </Button>
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
  flash: CanopCardFlash | undefined
  answer: (id: string) => void
  restart: () => void
}

function useCarteJeu(): UseCarteJeuResult {
  const { play } = useCanopSound()
  const viewport = useSvgMapViewport({ viewBox: franceMap.viewBox })
  const {
    value: flash,
    show: showFlash,
    clear: clearFlash,
  } = useTransientState<CanopCardFlash | undefined>(undefined)
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
        showFlash('success', CORRECT_DELAY)
        setScore((current) => current + 1)
        setResult((current) => ({ ...current, [id]: 'ok' }))
        later(() => {
          setRound((current) => current + 1)
          if (last) play('finish')
        }, CORRECT_DELAY)
        return
      }

      play('wrong')
      showFlash('error', WRONG_DELAY)
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
    [later, locked, play, round, showFlash, targetCode]
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
    clearFlash()
    viewport.reset()
    setQueue(shuffle(MAP_CODES).slice(0, ROUNDS))
    setRound(0)
    setScore(0)
    setResult({})
    setLocked(false)
  }, [clearFlash, play, viewport])

  return {
    viewport,
    round,
    score,
    finished: round >= ROUNDS,
    target: targetCode ? byCode[targetCode] : null,
    fill,
    flash,
    answer,
    restart,
  }
}

function CarteJeu() {
  const { viewport, round, score, finished, target, fill, flash, answer, restart } = useCarteJeu()

  return (
    <CarteBoard
      panel={
        finished || !target ? (
          <CarteResultat score={score} onRestart={restart} />
        ) : (
          <CarteConsigne round={round} score={score} target={target} flash={flash} />
        )
      }
      map={
        <CarteMap
          viewport={viewport}
          regions={PLAIN_REGIONS}
          fill={fill}
          selectable={!finished}
          onSelect={answer}
        />
      }
    />
  )
}

function CarteHeatmapPanel() {
  const { t } = useTranslation()

  return (
    <Card radius="xl" fill>
      <Stack gap="md" alignItems="stretch" justifyContent="center" fill>
        <Stack direction="row" gap="sm" alignItems="center">
          <Icon name="mapLocation" size="lg" color="primary" variant="solid" />
          <Heading level={3} size={4} gutterBottom={false}>
            {t('dm.carte.heatmap')}
          </Heading>
        </Stack>
        <Legend
          items={[
            { tone: 'success', label: t('dm.carte.legend.mastered') },
            { tone: 'warning', label: t('dm.carte.legend.average') },
            { tone: 'error', label: t('dm.carte.legend.weak') },
          ]}
        />
        <Text variant="caption" tone="muted">
          {t('dm.carte.legend.hint')}
        </Text>
      </Stack>
    </Card>
  )
}

function CarteHeatmap() {
  const viewport = useSvgMapViewport({ viewBox: franceMap.viewBox })
  const [stats] = useState(() => load().stats)
  const fill = useCallback((id: string) => heatFill(id, stats), [stats])

  return (
    <CarteBoard
      panel={<CarteHeatmapPanel />}
      map={<CarteMap viewport={viewport} regions={NAMED_REGIONS} fill={fill} />}
    />
  )
}

export default function Carte() {
  const [mode, setMode] = useState<CarteMode | null>(null)

  if (!mode) {
    return (
      <ViewIn key="setup">
        <CarteSetup onChoose={setMode} />
      </ViewIn>
    )
  }

  if (mode === 'jeu') {
    return (
      <ViewIn key="jeu">
        <CarteJeu />
      </ViewIn>
    )
  }

  return (
    <ViewIn key="heatmap">
      <CarteHeatmap />
    </ViewIn>
  )
}
