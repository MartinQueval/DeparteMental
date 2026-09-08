import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CanopI18nProvider, CanopSoundProvider, CanopThemeProvider } from 'canopui'
// Les polices Chivo et Titan One sont auto-hébergées par la librairie et
// déclarées ici : sans cette feuille, le thème retombe sur `system-ui`.
import 'canopui/styles.css'
import App from './App.tsx'
import { gameMessages } from './lib/messages.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CanopThemeProvider storageKey="departemental:theme">
      <CanopI18nProvider locale="fr" messages={gameMessages} storageKey="departemental:langue">
        {/* La clé reprend le préfixe des sauvegardes du jeu, pour que le
            réglage reste avec les autres et non sous le nom de la librairie. */}
        <CanopSoundProvider storageKey="departemental:son">
          <App />
        </CanopSoundProvider>
      </CanopI18nProvider>
    </CanopThemeProvider>
  </StrictMode>,
)
