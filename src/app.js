// L'application Express : rendu serveur (EJS), formulaires classiques, sessions en base.
import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { ligne } from './bdd.js';
import { magasin } from './sessions.js';
import { entetes, verifierOrigine } from './securite.js';
import { actif as courrielActif } from './courriel.js';
import { format } from './temps.js';
import * as notation from './notation.js';
import publiques from './routes/publiques.js';
import seances from './routes/seances.js';
import suivi from './routes/suivi.js';
import compte from './routes/compte.js';
import admin from './routes/admin.js';

/** Un pictogramme de la planche Lucide (décoratif : le texte voisin porte le sens). */
const icone = (nom, classe = '') =>
  `<svg class="bw-icone ${classe}" aria-hidden="true" focusable="false"><use href="/identite/icones/icones.svg#${nom}"/></svg>`;

const dossier = (chemin) => fileURLToPath(new URL(chemin, import.meta.url));

export const app = express();

app.set('view engine', 'ejs');
app.set('views', dossier('../vues'));
app.set('trust proxy', 1); // derrière Traefik : adresse du visiteur et HTTPS
app.disable('x-powered-by');

app.use(entetes);
// Ce dont tous les gabarits ont besoin, posé avant tout (les pages d'erreur s'en servent aussi)
app.use((req, res, next) => {
  Object.assign(res.locals, { utilisateur: null, flash: null, chemin: req.path, courrielActif, format, notation, icone });
  next();
});
app.use(
  express.static(dossier('../public'), {
    maxAge: config.production ? '7d' : 0,
    setHeaders(res, chemin) {
      if (/\.(woff2|svg|png|ico)$/.test(chemin)) res.setHeader('Cache-Control', 'public, max-age=2592000');
    },
  }),
);

// Santé : la page répond et la base aussi (sonde de la plateforme après chaque déploiement)
app.get('/sante', async (req, res) => {
  try {
    await ligne('SELECT 1 AS ok');
    res.type('text').send('ok');
  } catch {
    res.status(503).type('text').send('base indisponible');
  }
});

app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(express.json({ limit: '8mb' })); // import de questions par l'administration
app.use(
  session({
    name: 'pharmat',
    store: magasin,
    secret: config.secretSession,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: 30 * 86400e3 },
  }),
);
app.use(verifierOrigine);

// Compte connecté, relu à chaque requête : un compte supprimé ou rétrogradé l'est aussitôt
app.use(async (req, res, next) => {
  if (req.session.idUtilisateur) {
    const u = await ligne('SELECT id_user, name, mail, status FROM users WHERE id_user = ?', [req.session.idUtilisateur]);
    if (u) res.locals.utilisateur = { id: u.id_user, nom: u.name, mail: u.mail, admin: u.status === 'ADMIN' };
    else delete req.session.idUtilisateur;
  }
  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  }
  next();
});

// Anciennes adresses (Pharmat 1), encore présentes dans des favoris et d'anciens courriels
const anciennes = { '/login': '/connexion', '/register': '/inscription', '/home': '/accueil', '/dashboard': '/accueil', '/qcms': '/accueil', '/training': '/entrainement', '/revision/': '/revision', '/exam': '/examen', '/history': '/historique', '/stats': '/statistiques', '/notif': '/compte' };
app.use((req, res, next) => (req.method === 'GET' && anciennes[req.path] ? res.redirect(301, anciennes[req.path]) : next()));

app.use(publiques);
app.use(seances);
app.use(suivi);
app.use(compte);
app.use('/admin', admin);

app.use((req, res) => {
  res.status(404).render('erreur', { titre: 'Page introuvable', code: 404, message: "Cette page n'existe pas, ou plus." });
});

// eslint-disable-next-line no-unused-vars
app.use((erreur, req, res, next) => {
  console.error(erreur);
  const code = erreur.status && erreur.status < 500 ? erreur.status : 500;
  res.status(code).render('erreur', {
    titre: code === 500 ? 'Erreur du serveur' : 'Requête invalide',
    code,
    message: code === 500 ? 'Un problème est survenu de notre côté. Réessaie dans un instant.' : 'La requête est mal formée.',
  });
});

