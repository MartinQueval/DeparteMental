# DéparteMental 🇫🇷

**▶️ Jouer : [departe-mental.vercel.app](https://departe-mental.vercel.app)**

Le jeu pour enfin retenir les 101 départements français : codes, noms, préfectures et sous-préfectures.

## Modes de jeu

- ⚡ **Quiz éclair** — 60 secondes, QCM ou saisie clavier, streak avec multiplicateur
- 📚 **Entraînement** — un thème au choix (préfectures, sous-préfectures, codes, noms, régions), 10 vies, questions à la chaîne tirées vers tes points faibles
- 📅 **Défi du jour** — un département mystère par jour, indices progressifs, résultat partageable
- 🗺️ **Carte** — localiser les départements sur la carte de France + heatmap de progression

Toute la progression est stockée en `localStorage` — pas de compte, pas de backend.

## Stack

React 19 + TypeScript + Vite. Données issues de `départements.csv.txt` (source de vérité), converties en JSON :

```bash
npm run data    # régénère src/data/departements.json depuis le CSV
```

## Développement

```bash
npm install
npm run dev     # http://localhost:5180
npm run lint
npm run build   # type-check (tsc -b) + build prod
```
