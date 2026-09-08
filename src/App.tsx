import { useState } from 'react'
import {
  CardGrid,
  Heading,
  Icon,
  PageContent,
  Pressable,
  ProgressBar,
  SoundToggle,
  Stack,
  Text,
  useCanopSound,
  type CanopIconName,
} from 'canopui'
import Quiz from './modes/Quiz.tsx'
import Entrainement from './modes/Entrainement.tsx'
import Daily from './modes/Daily.tsx'
import Carte from './modes/Carte.tsx'
import { departements } from './lib/departements.ts'
import { Cascade, CascadeItem } from './lib/motion.tsx'
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
  onPick: (id: ModeId) => void
}

function ModeGrid({ onPick }: ModeGridProps) {
  return (
    <Cascade>
      <CardGrid minItemWidth="15rem" gap="md">
        {MODES.map((m) => (
          <CascadeItem key={m.id} stretch>
            <Pressable onClick={() => onPick(m.id)} padding="lg" fullWidth ariaLabel={m.title}>
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

export default function App() {
  const [view, setView] = useState<View>('home')
  const { play } = useCanopSound()

  if (view !== 'home') {
    const Mode = MODE_COMPONENTS[view]
    return (
      <PageContent>
        <Stack gap="md" alignItems="stretch">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Pressable
              onClick={() => {
                play('click')
                setView('home')
              }}
              padding="sm"
              ariaLabel="Revenir au menu"
            >
              <Stack direction="row" gap="xs" alignItems="center">
                <Icon name="arrowLeft" size="sm" />
                <Text variant="label">Menu</Text>
              </Stack>
            </Pressable>
            <SoundToggle />
          </Stack>
          <Mode key={view} />
        </Stack>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <Stack gap="lg" alignItems="stretch">
        <Stack direction="row" justifyContent="end">
          <SoundToggle />
        </Stack>

        <Stack gap="xs" alignItems="center">
          <Heading level={1} align="center">
            Départe<Text as="span" tone="primary" weight="extrabold">Mental</Text>
          </Heading>
          <Text variant="lead" tone="muted" align="center">
            Le jeu pour enfin retenir les {TOTAL} départements
          </Text>
        </Stack>

        <Progression />

        <ModeGrid
          onPick={(id) => {
            play('start')
            setView(id)
          }}
        />
      </Stack>
    </PageContent>
  )
}
