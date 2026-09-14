# DéparteMental 🇫🇷

**▶️ Le jeu se lance en local** — voir [Développement](#développement). Il n'y a pas de version en
ligne : `canopui` est publiée sur le registre privé `npm.qvl-project.com`, qu'un hébergeur ne peut
pas lire sans jeton.

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

Les versions de l'outillage sont plafonnées par la librairie : **vite ^7**, **@mui/material ^9**,
**framer-motion ^13**, **react 19** et **@emotion ^11** sont ses dépendances de pair, donc c'est
**notre** copie qu'elle utilise. Monter au-delà d'une de ces bornes casse le build.

Données issues de `départements.csv.txt` (source de vérité), converties en JSON :

```bash
npm run data    # régénère src/data/departements.json depuis le CSV
```

## Développement

CanopUI est consommée depuis le registre privé de la flotte, déclaré dans le `.npmrc` du repo :
`registry=https://npm.qvl-project.com/`. Il relaie aussi npmjs, donc tout le reste des dépendances
passe par lui — un clone frais n'a besoin de rien d'autre que d'un accès au registre.

La version est **épinglée à l'exact** (`"canopui": "3.0.1"`) et non en `^` : une montée de la
librairie se décide et se relit, elle ne s'attrape pas au détour d'un `npm install`.

```bash
npm install
npm run dev     # http://localhost:5180
npm run lint
npm run build   # type-check (tsc -b) + build prod
```
