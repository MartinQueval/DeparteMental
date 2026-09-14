import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Les six scènes de `CanopyBackground` (32 Mo) ne peuvent pas traverser le
// bundle : en mode librairie, Vite inline en base64 tout asset importé depuis
// le JS. Elles sont donc servies comme des fichiers par ce greffon livré avec
// la librairie — middleware en développement, recopie dans la sortie au build.
// Sans lui, le fond par défaut de `PageScaffold` reste noir. Depuis la 3.0.1 il
// sert aussi les fichiers du worker MapLibre, que nous n'utilisons pas.
import { canopyVideo } from 'canopui/vite'

export default defineConfig({
  plugins: [react(), canopyVideo()],
  server: {
    port: 5180,
  },
})
