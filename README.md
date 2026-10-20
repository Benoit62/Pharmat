# Pharmat

Révision des QCM de l'internat de pharmacie : les annales du concours (1991 à 2022, plus de
2 300 questions), en **entraînement** (séries tirées au hasard, par année ou par matière), en
**révision** (une année entière, étape par étape) ou en **examen blanc** chronométré, avec une
correction détaillée selon le barème du concours et des statistiques de progression.

En service sur **https://pharmat.benoitwattinne.fr**, hébergé sur le serveur décrit dans le dépôt
Infra.

## Fonctionnalités

| | |
|---|---|
| Comptes | inscription, confirmation de l'adresse par courriel, mot de passe oublié, changement de prénom et de mot de passe, suppression du compte et de tout l'historique |
| Entraînement | 10 à 60 questions au hasard, dans une année ou toutes, filtrables par matière ; relance « comme la dernière fois » |
| Révision | progression gardée par année, étapes de 10 à 60 questions, remise à zéro (l'ancienne progression reste consultable) |
| Examen blanc | une annale complète, 90 s par question, copie rendue automatiquement à l'échéance |
| Partie en cours | gardée en base : elle survit à un rechargement, à un redéploiement, se reprend depuis l'accueil ; navigation libre entre les questions, raccourcis clavier (A à E, Entrée) |
| Correction | réponses justes, oubliées, cochées à tort ; points et erreurs par question ; filtre « erreurs seulement » |
| Historique | entraînements, révisions et examens, chacun avec sa correction |
| Statistiques | réussite moyenne, jours d'affilée, activité sur 14 jours, réussite des 30 dernières séries, réussite par matière (points faibles d'abord), QCS et QCM |
| Courriels | rappel du soir espacé (veille active, puis 2, 7, 14 et 30 jours d'absence), bilan du jour ; réglables dans « Mon compte », désinscription en un clic |
| Administration | tableau de bord, comptes (rôle, confirmation, relance, suppression), questions (recherche, ajout, modification, suppression, annulation), import et export JSON |

### Barème

- **QCS** (une seule bonne réponse) : 2 points si juste, 0 sinon.
- **QCM** (une ou plusieurs) : on compte les erreurs (case cochée à tort, bonne réponse oubliée) :
  0 erreur → 2 points, 1 → 1, 2 → 0,4, au-delà → 0.

Une question annulée au concours est gardée mais n'entre dans aucune série.

## Technique

Node.js 24, Express 5, gabarits EJS rendus côté serveur, MariaDB (mysql2). Les pages sont des
formulaires classiques (l'application fonctionne sans JavaScript) ; un petit script ajoute les
raccourcis clavier, le chronomètre et l'import par glisser-déposer. Aucune ressource externe :
polices, pictogrammes et styles sont servis par l'application, sous une politique de sécurité
stricte (CSP).

```
serveur.js            point d'entrée : application web et tâches du soir
src/
  app.js              Express : sécurité, sessions, routes, erreurs
  routes/             publiques, séances (accueil, partie), suivi (historique, statistiques), compte, admin
  partie.js           la partie en cours : création, réponses, clôture et enregistrement
  notation.js         le barème
  activite.js         l'activité par jour (statistiques, rappels)
  taches.js           rappels et bilans du soir
  courriel.js         envoi (facultatif) et gabarits
  sessions.js         sessions de navigation dans MariaDB
  bdd.js, config.js, securite.js, temps.js, evenement.js, phrases.js, outils.js
vues/                 gabarits EJS
public/               styles, script, logo, icônes ; identite/ = extraits du kit Identity
migrations/           schéma SQL versionné, appliqué par outils/migrer.js
test/                 tests (node --test)
```

### Design

Le kit [Identity](https://github.com/Benoit62/Identity) fournit les composants (`bw-`), le
sélecteur de thème et la police Figtree, importés par `outils/importer-kits.py` (avec une planche
de pictogrammes Lucide propre à Pharmat). Pharmat en laisse la partie organique (Bricolage
Grotesque, papier chaud, courbes de niveau) pour une version lisse, aux verts clairs de la
pharmacie : voir `public/css/pharmat.css`. Thème clair par défaut, sombre au choix.

Le logo est une gélule dont une moitié porte une coche : la pharmacie et le QCM.
`public/img/logo.svg` (logo seul), `public/favicon.svg` (pastille) ; les PNG et le `.ico` se
régénèrent avec `python outils/generer-icones.py`.

## Développer

Il faut Node 24 et une MariaDB (11.x).

```bash
cp .env.exemple .env
```

Renseigner la base dans `.env`, puis :

```bash
npm install
```

```bash
npm run migrer
```

```bash
npm run dev
```

L'application écoute sur http://localhost:3000. Le premier compte se passe administrateur en
base : `UPDATE users SET status = 'ADMIN' WHERE mail = '…';`. Les questions s'importent depuis
l'administration (fichiers `.json` exportés par Pharmat ou `.seqa` de la première version).

Tests :

```bash
npm test
```

## Mise en ligne

Chaque push sur `main` publie l'image `ghcr.io/benoit62/pharmat` (workflow
`.github/workflows/deploy.yml`, copié du dépôt Infra). Le serveur la déploie dans les deux
minutes : export de la base, migrations (`outils/migrer.js`), bascule si `/sante` répond. Ce que
le projet demande à la plateforme est dans `.infra/deploy.yaml` ; sa carte sur le portail des
applications, dans `.infra/card/`.

Le courriel est facultatif : sans `SMTP_HOST`, les inscriptions sont confirmées d'office, les
rappels sont coupés et « mot de passe oublié » est masqué. Il s'active avec le relais de la
plateforme (`addons.mail`, à venir).

La première version de Pharmat est conservée à l'étiquette `ancien-pharmat`.

Prochaines évolutions : [EVOLUTIONS.md](EVOLUTIONS.md).
