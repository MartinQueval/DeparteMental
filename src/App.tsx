import { useMemo, useState } from 'react'
import {
  Card,
  PageContent,
  PageScaffold,
  ProgressBar,
  SoundToggle,
  Stack,
  useBreakpointDown,
  useCanopSound,
  useTranslation,
  type CanopIconName,
  type CanopNavbarItem,
  type CanopPageContentMaxWidth,
} from 'canopui'
import Quiz from './modes/Quiz.tsx'
import Entrainement from './modes/Entrainement.tsx'
import Daily from './modes/Daily.tsx'
import Carte from './modes/Carte.tsx'
import { departements } from './lib/departements.ts'
import { TileGrid, type TileModel } from './lib/tiles.tsx'
import { load } from './lib/storage.ts'

type ModeId = 'quiz' | 'entrainement' | 'daily' | 'carte'
type View = 'home' | ModeId

interface ModeDefinition {
  id: ModeId
  icon: CanopIconName
}

const MODES: readonly ModeDefinition[] = [
  { id: 'quiz', icon: 'lightning' },
  { id: 'entrainement', icon: 'book' },
  { id: 'daily', icon: 'calendar' },
  { id: 'carte', icon: 'mapLocation' },
]

const MODE_COMPONENTS: Record<ModeId, () => React.JSX.Element | null> = {
  quiz: Quiz,
  entrainement: Entrainement,
  daily: Daily,
  carte: Carte,
}

const TOTAL = departements.length
const GAME_TITLE = 'DéparteMental'
const HOME_HREF = '/'
const CONTENT_MAX_WIDTH: CanopPageContentMaxWidth = 'md'
const HOME_MAX_WIDTH: CanopPageContentMaxWidth = 'lg'
const PROGRESS_SCALE = 100
const DOCKED_SOUND_SIZE = '2.75rem'
const HEADER_SOUND_SIZE = '3.5rem'

function modeHref(id: ModeId): string {
  return `/${id}`
}

function HeaderSound() {
  const docked = useBreakpointDown('sm')

  return (
    <SoundToggle
      size={docked ? DOCKED_SOUND_SIZE : HEADER_SOUND_SIZE}
      iconSize={docked ? 'md' : 'lg'}
    />
  )
}

function useModeTiles(): TileModel<ModeId>[] {
  const { t } = useTranslation()

  return useMemo<TileModel<ModeId>[]>(
    () =>
      MODES.map(({ id, icon }) => ({
        id,
        icon,
        title: t(`dm.mode.${id}.title`),
        desc: t(`dm.mode.${id}.desc`),
      })),
    [t]
  )
}

function useNavItems(tiles: TileModel<ModeId>[]): CanopNavbarItem[] {
  const { t } = useTranslation()

  return useMemo<CanopNavbarItem[]>(
    () => [
      { label: t('dm.nav.home'), icon: 'home', href: HOME_HREF },
      ...tiles.map((tile) => ({ label: tile.title, icon: tile.icon, href: modeHref(tile.id) })),
    ],
    [t, tiles]
  )
}

function maitrises(): number {
  const { stats } = load()
  return departements.filter((d) => {
    const s = stats[d.code]
    return s && s.seen >= 3 && s.ok / s.seen >= 0.8
  }).length
}

function Progression() {
  const { t } = useTranslation()
  const acquis = maitrises()

  return (
    <ProgressBar
      value={(acquis / TOTAL) * PROGRESS_SCALE}
      label={t('dm.home.progress', { value: acquis, max: TOTAL })}
    />
  )
}

interface HomeProps {
  tiles: TileModel<ModeId>[]
  onPick: (href: string) => void
}

function Home({ tiles, onPick }: HomeProps) {
  return (
    <Stack gap="lg" alignItems="stretch">
      <Card variant="floating">
        <Progression />
      </Card>
      <TileGrid tiles={tiles} onPick={(id) => onPick(modeHref(id))} />
    </Stack>
  )
}

interface ModeViewProps {
  mode: ModeId
}

function ModeView({ mode }: ModeViewProps) {
  const Mode = MODE_COMPONENTS[mode]

  return <Mode />
}

interface GameNavigation {
  view: View
  activeHref: string
  subtitle: string
  navigate: (href: string) => void
}

function useGameNavigation(tiles: TileModel<ModeId>[]): GameNavigation {
  const [view, setView] = useState<View>('home')
  const { play } = useCanopSound()
  const { t } = useTranslation()

  const activeMode = tiles.find((tile) => tile.id === view)

  const navigate = (href: string) => {
    const target = tiles.find((tile) => modeHref(tile.id) === href)
    const next: View = target ? target.id : 'home'
    if (next === view) return
    play(next === 'home' ? 'click' : 'start')
    setView(next)
  }

  return {
    view,
    activeHref: activeMode ? modeHref(activeMode.id) : HOME_HREF,
    subtitle: activeMode ? activeMode.desc : t('dm.home.tagline', { total: TOTAL }),
    navigate,
  }
}

export default function App() {
  const tiles = useModeTiles()
  const items = useNavItems(tiles)
  const { view, activeHref, subtitle, navigate } = useGameNavigation(tiles)

  return (
    <PageScaffold
      navbarTitle={GAME_TITLE}
      title={GAME_TITLE}
      subtitle={subtitle}
      headerActions={<HeaderSound />}
      actionsPlacement="floating"
      items={items}
      activeHref={activeHref}
      onNavigate={navigate}
    >
      <PageContent key={view} maxWidth={view === 'home' ? HOME_MAX_WIDTH : CONTENT_MAX_WIDTH}>
        {view === 'home' ? <Home tiles={tiles} onPick={navigate} /> : <ModeView mode={view} />}
      </PageContent>
    </PageScaffold>
  )
}
