import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  CanopI18nProvider,
  CanopSoundProvider,
  CanopThemeProvider,
  CanopyBackground,
} from 'canopui'
// Les polices Chivo et Titan One sont auto-hébergées par la librairie et
// déclarées ici : sans cette feuille, le thème retombe sur `system-ui`.
import 'canopui/styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CanopThemeProvider storageKey="departemental:theme">
      <CanopI18nProvider locale="fr">
        {/* La clé reprend le préfixe des sauvegardes du jeu, pour que le
            réglage reste avec les autres et non sous le nom de la librairie. */}
        <CanopSoundProvider storageKey="departemental:son">
          {/* Monté ici, une seule fois, et non dans les branches de rendu
              d'`App` : la scène pèse 32 Mo, et un démontage la ferait
              retélécharger à chaque changement d'écran. La hauteur est fixée
              pour que le fond reste en place et que le défilement se fasse
              dans `PageContent` ; `dvh` tient compte de la barre d'adresse
              mobile, que `vh` ignore. */}
          <CanopyBackground
            minHeight="100dvh"
            sx={{ height: '100dvh' }}
            contentSx={{ flex: 1, minHeight: 0 }}
          >
            <App />
          </CanopyBackground>
        </CanopSoundProvider>
      </CanopI18nProvider>
    </CanopThemeProvider>
  </StrictMode>,
)
