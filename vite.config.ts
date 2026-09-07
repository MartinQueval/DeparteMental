import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Les six scenes de `CanopyBackground` (32 Mo) ne peuvent pas traverser le
// bundle : en mode librairie Vite inline en base64 tout asset importe depuis le
// JS. Elles sont donc servies comme des fichiers par ce greffon livre avec la
// librairie -- middleware en developpement, recopie dans la sortie au build.
// Sans lui, le fond par defaut de `PageScaffold` reste noir.
import { canopyVideo } from 'canopui/vite'

export default defineConfig({
  plugins: [react(), canopyVideo()],
  resolve: {
    // `canopui` est installée en dépendance `file:`, donc montée en lien
    // symbolique : ce qu'elle importe se résout depuis son propre dossier, où
    // vivent ses dépendances de développement. Sans ce dédoublonnage, la page
    // charge deux React — et deux React donnent « Invalid hook call » — ainsi
    // que deux Emotion, ce qui casserait le thème sans rien dire. `framer-motion`
    // est logé à la même enseigne depuis qu'il est passé en dépendance de pair :
    // le jeu et la librairie en ont chacun une copie, et deux moteurs
    // d'animation, ce sont deux contextes React — les hooks `useStagger` et
    // `useEnterAnimation` de la librairie ne verraient pas les `motion` du jeu.
    dedupe: [
      'react',
      'react-dom',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      'framer-motion',
    ],
  },
  optimizeDeps: {
    // Le paquet est monté en lien symbolique : l'optimiseur essayait de le
    // pré-bundler et n'y retrouvait plus son entrée. On le lui laisse tel
    // quel, ce qui a l'avantage de propager une reconstruction de la
    // librairie sans vider le cache.
    exclude: ['canopui'],
  },
  server: {
    port: 5180,
  },
})
