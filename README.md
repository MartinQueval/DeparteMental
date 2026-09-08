# DéparteMental 🇫🇷

**▶️ Le jeu se lance en local** — voir [Développement](#développement). Il n'y a pas de version en
ligne : la dépendance `canopui` est montée en lien local (`file:../../QVL-CanopUI`), qui n'existe
pas sur un hébergeur.

Le jeu pour enfin retenir les 101 départements français : codes, noms, préfectures et sous-préfectures.

## Modes de jeu

- ⚡ **Quiz éclair** — 60 secondes, QCM ou saisie clavier, streak avec multiplicateur
- 📚 **Entraînement** — un thème au choix (préfectures, sous-préfectures, codes, noms, régions), 10 vies, questions à la chaîne tirées vers tes points faibles
- 📅 **Défi du jour** — un département mystère par jour, indices progressifs, résultat partageable
- 🗺️ **Carte** — localiser les départements sur la carte de France + heatmap de progression

Toute la progression est stockée en `localStorage` — pas de compte, pas de backend.

## Stack

React 19 + TypeScript + Vite, et **CanopUI** — le design system maison, qui fournit ici le thème,
les composants (`Card`, `Choice`, `SvgMap`, `Lives`…), les sons et le fond animé.

Les versions de l'outillage sont plafonnées par la librairie : **vite ^7** (sa dépendance de pair),
**typescript 5.9** et **eslint ^9**, alignés sur les siens — montée en lien symbolique, elle résout
ses types et sa configuration de lint depuis son propre dossier. Monter au-delà casse le build.

Données issues de `départements.csv.txt` (source de vérité), converties en JSON :

```bash
npm run data    # régénère src/data/departements.json depuis le CSV
```

## Développement

CanopUI n'est pas publiée : elle est consommée en dépendance locale
(`"canopui": "file:../../QVL-CanopUI"`). Un clone frais ne démarre pas tant que le repo voisin n'est
pas présent **et construit** — `npm install` résout le lien vers `dist/`, qui n'existe qu'après un
build de la librairie.

```bash
git clone <QVL-CanopUI> ../../QVL-CanopUI
cd ../../QVL-CanopUI && npm install && npm run build
```

Puis, depuis ce repo :

```bash
npm install
npm run dev     # http://localhost:5180
npm run lint
npm run build   # type-check (tsc -b) + build prod
```
