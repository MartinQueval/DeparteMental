import { useState } from 'react'
import Quiz from './modes/Quiz.tsx'
import Flashcards from './modes/Flashcards.tsx'
import Daily from './modes/Daily.tsx'
import Carte from './modes/Carte.tsx'
import { departements } from './lib/departements.ts'
import { load } from './lib/storage.ts'

type ModeId = 'quiz' | 'cards' | 'daily' | 'carte'
type View = 'home' | ModeId

interface ModeDef {
  id: ModeId
  icon: string
  title: string
  desc: string
}

const MODES: ModeDef[] = [
  {
    id: 'quiz',
    icon: '⚡',
    title: 'Quiz éclair',
    desc: '60 secondes, un max de bonnes réponses. Enchaîne pour le multiplicateur !',
  },
  {
    id: 'cards',
    icon: '🃏',
    title: 'Flashcards',
    desc: 'Révision espacée : l’app insiste sur les départements que tu rates.',
  },
  {
    id: 'daily',
    icon: '📅',
    title: 'Défi du jour',
    desc: 'Un département mystère par jour, des indices à chaque essai.',
  },
  {
    id: 'carte',
    icon: '🗺️',
    title: 'Carte',
    desc: 'Clique le bon département sur la carte de France.',
  },
]

const MODE_COMPONENTS: Record<ModeId, () => React.JSX.Element | null> = {
  quiz: Quiz,
  cards: Flashcards,
  daily: Daily,
  carte: Carte,
}

function Progress() {
  const { stats } = load()
  const mastered = departements.filter((d) => {
    const s = stats[d.code]
    return s && s.seen >= 3 && s.ok / s.seen >= 0.8
  }).length
  return (
    <div className="progress">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(mastered / 101) * 100}%` }} />
      </div>
      <span className="progress-label">{mastered} / 101 départements maîtrisés</span>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('home')

  if (view !== 'home') {
    const Mode = MODE_COMPONENTS[view]
    return (
      <div className="app">
        <div className="view" key={view}>
          <header className="mode-header">
            <button className="btn-back" onClick={() => setView('home')}>← Menu</button>
          </header>
          <Mode />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="view" key="home">
        <header className="home-header">
          <h1>
            Départe<span className="accent">Mental</span>
          </h1>
          <p className="tagline">Le jeu pour enfin retenir les 101 départements 🇫🇷</p>
        </header>
        <Progress />
        <main className="mode-grid">
          {MODES.map((m) => (
            <button key={m.id} className="mode-card" onClick={() => setView(m.id)}>
              <span className="mode-icon">{m.icon}</span>
              <span className="mode-title">{m.title}</span>
              <span className="mode-desc">{m.desc}</span>
            </button>
          ))}
        </main>
      </div>
    </div>
  )
}
