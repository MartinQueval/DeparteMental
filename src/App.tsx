import { useState } from 'react'
import {
  Card,
  CardGrid,
  Heading,
  Icon,
  PageContent,
  PageScaffold,
  Pressable,
  ProgressBar,
  SoundToggle,
  Stack,
  Text,
  useCanopSound,
  type CanopIconName,
  type CanopNavbarItem,
} from 'canopui'
import Quiz from './modes/Quiz.tsx'
import Entrainement from './modes/Entrainement.tsx'
import Daily from './modes/Daily.tsx'
import Carte from './modes/Carte.tsx'
import { departements } from './lib/departements.ts'
import { Cascade, CascadeItem } from './lib/motion.tsx'
import { TILE_SURFACE } from './lib/surface.ts'
import { load } from './lib/storage.ts'

type ModeId = 'quiz' | 'entrainement' | 'daily' | 'carte'
type View = 'home' | ModeId

interface ModeDef {
  id: ModeId
  icon: CanopIconName
  title: string
  desc: string
}

const MODES: ModeDef[] = [
  {
    id: 'quiz',
    icon: 'lightning',
    title: 'Quiz éclair',
    desc: '60 secondes, un max de bonnes réponses. Enchaîne pour le multiplicateur !',
  },
  {
    id: 'entrainement',
    icon: 'book',
    title: 'Entraînement',
    desc: 'Choisis ton thème et révise-le à fond.',
  },
  {
    id: 'daily',
    icon: 'calendar',
    title: 'Défi du jour',
    desc: 'Un département mystère par jour, des indices à chaque essai.',
  },
  {
    id: 'carte',
    icon: 'mapLocation',
    title: 'Carte',
    desc: 'Clique le bon département sur la carte de France.',
  },
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
const HOME_TAGLINE = `Le jeu pour enfin retenir les ${TOTAL} départements`

function modeHref(id: ModeId): string {
  return `/${id}`
}

const NAV_ITEMS: CanopNavbarItem[] = [
  { label: 'Accueil', icon: 'home', href: HOME_HREF },
  ...MODES.map((m) => ({ label: m.title, icon: m.icon, href: modeHref(m.id) })),
]

function maitrises(): number {
  const { stats } = load()
  return departements.filter((d) => {
    const s = stats[d.code]
    return s && s.seen >= 3 && s.ok / s.seen >= 0.8
  }).length
}

function Progression() {
  const acquis = maitrises()

  return (
    <ProgressBar
      value={acquis}
      max={TOTAL}
      label={`${acquis} / ${TOTAL} départements maîtrisés`}
    />
  )
}

interface ModeGridProps {
  onPick: (href: string) => void
}

function ModeGrid({ onPick }: ModeGridProps) {
  return (
    <Cascade>
      <CardGrid minItemWidth="15rem" gap="md">
        {MODES.map((m) => (
          <CascadeItem key={m.id} stretch>
            <Pressable
              onClick={() => onPick(modeHref(m.id))}
              padding="lg"
              background={TILE_SURFACE}
              fullWidth
              ariaLabel={m.title}
            >
              <Stack gap="sm" alignItems="start">
                <Icon name={m.icon} size="lg" color="primary" variant="solid" />
                <Heading level={3} size={4}>
                  {m.title}
                </Heading>
                <Text variant="body-sm" tone="muted">
                  {m.desc}
                </Text>
              </Stack>
            </Pressable>
          </CascadeItem>
        ))}
      </CardGrid>
    </Cascade>
  )
}

interface HomeProps {
  onPick: (href: string) => void
}

function Home({ onPick }: HomeProps) {
  return (
    <>
      <Card variant="floating">
        <Progression />
      </Card>
      <ModeGrid onPick={onPick} />
    </>
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

function useGameNavigation(): GameNavigation {
  const [view, setView] = useState<View>('home')
  const { play } = useCanopSound()

  const activeMode = MODES.find((m) => m.id === view)

  const navigate = (href: string) => {
    const target = MODES.find((m) => modeHref(m.id) === href)
    const next: View = target ? target.id : 'home'
    if (next === view) return
    play(next === 'home' ? 'click' : 'start')
    setView(next)
  }

  return {
    view,
    activeHref: activeMode ? modeHref(activeMode.id) : HOME_HREF,
    subtitle: activeMode ? activeMode.desc : HOME_TAGLINE,
    navigate,
  }
}

export default function App() {
  const { view, activeHref, subtitle, navigate } = useGameNavigation()

  return (
    <PageScaffold
      navbarTitle={GAME_TITLE}
      title={GAME_TITLE}
      subtitle={subtitle}
      headerActions={<SoundToggle />}
      items={NAV_ITEMS}
      activeHref={activeHref}
      onNavigate={navigate}
    >
      <PageContent key={view}>
        {view === 'home' ? <Home onPick={navigate} /> : <ModeView mode={view} />}
      </PageContent>
    </PageScaffold>
  )
}
