// Accueil connecté, choix d'une séance (entraînement, révision, examen) et la partie en cours.
import { Router } from 'express';
import { requete, ligne } from '../bdd.js';
import { exigerConnexion } from '../securite.js';
import { flash, entier, liste } from '../outils.js';
import { activiteDe } from '../activite.js';
import { jour, serieDeJours } from '../temps.js';
import { taux } from '../notation.js';
import { phraseAccueil, phraseEncouragement } from '../phrases.js';
import * as partie from '../partie.js';

const routes = Router();
routes.use(['/accueil', '/entrainement', '/revision', '/examen', '/partie'], exigerConnexion);

/** Années disponibles, avec leur nombre de questions. */
const annees = () => requete('SELECT year AS annee, COUNT(*) AS questions FROM qcm WHERE annulee = 0 GROUP BY year ORDER BY year DESC');

/** Progression de révision de chaque année pour un compte. */
async function progressionRevision(idUtilisateur) {
  const lignes = await requete(
    `SELECT q.year AS annee, COUNT(*) AS total, COUNT(a.id_revision_answer) AS faites, COALESCE(SUM(a.score), 0) AS points,
            MAX(r.id_revision) AS id_revision, MAX(a.cree_le) AS derniere
       FROM qcm q
       LEFT JOIN revision_sessions r ON r.year = q.year AND r.id_user = ? AND r.active = 1
       LEFT JOIN revision_session_answers a ON a.id_revision = r.id_revision AND a.id_qcm = q.id_qcm
      WHERE q.annulee = 0
      GROUP BY q.year ORDER BY q.year DESC`,
    [idUtilisateur],
  );
  return lignes.map((l) => ({ ...l, points: Number(l.points), reussite: taux(Number(l.points), l.faites) }));
}

// ---------- Accueil ----------
routes.get('/accueil', async (req, res) => {
  const id = req.session.idUtilisateur;
  const [derniere, revisions, activite, examens] = await Promise.all([
    ligne("SELECT year, size, id_category FROM training_sessions WHERE id_user = ? AND mode = 'entrainement' ORDER BY id_session DESC LIMIT 1", [id]),
    progressionRevision(id),
    activiteDe(id, 60),
    ligne("SELECT COUNT(*) AS n FROM training_sessions WHERE id_user = ? AND mode = 'examen'", [id]),
  ]);
  const enCours = revisions.filter((r) => r.faites > 0 && r.faites < r.total).sort((a, b) => (b.derniere ?? 0) - (a.derniere ?? 0))[0];
  const aujourdhui = activite.get(jour()) ?? { questions: 0, points: 0 };
  let semaine = { questions: 0, points: 0 };
  for (const [j, v] of activite) if (j >= jour(new Date(Date.now() - 6 * 86400e3))) semaine = { questions: semaine.questions + v.questions, points: semaine.points + v.points };

  res.render('accueil', {
    titre: 'Accueil',
    phrase: phraseAccueil(res.locals.utilisateur.nom),
    encouragement: phraseEncouragement(),
    partieEnCours: req.session.partie ?? null,
    derniere,
    revision: enCours ?? null,
    examens: examens.n,
    chiffres: {
      serie: serieDeJours([...activite.keys()]),
      aujourdhui: aujourdhui.questions,
      semaine: semaine.questions,
      reussite: taux(semaine.points, semaine.questions),
    },
  });
});

/** Lance une partie et ouvre la première question, ou revient au formulaire avec l'erreur. */
async function lancer(req, res, options, retour) {
  if (req.session.partie && req.body.remplacer !== 'oui') {
    flash(req, 'attention', 'Une partie est déjà en cours : termine-la ou abandonne-la avant d’en lancer une autre.');
    return res.redirect('/partie');
  }
  const erreur = await partie.creer(req, options);
  if (erreur) {
    flash(req, 'erreur', erreur);
    return res.redirect(retour);
  }
  res.redirect('/partie');
}

// ---------- Entraînement ----------
routes.get('/entrainement', async (req, res) => {
  const [listeAnnees, matieres] = await Promise.all([
    annees(),
    requete(
      `SELECT c.id_category AS id, c.name AS nom, COUNT(*) AS questions
         FROM categories c JOIN qcms_categories qc ON qc.category = c.id_category JOIN qcm q ON q.id_qcm = qc.qcm AND q.annulee = 0
        GROUP BY c.id_category ORDER BY c.name`,
    ),
  ]);
  res.render('entrainement', { titre: 'Entraînement', annees: listeAnnees, matieres, nombres: partie.NOMBRES, choix: req.query });
});

routes.post('/entrainement', (req, res) =>
  lancer(req, res, {
    mode: 'entrainement',
    annee: entier(req.body.annee),
    categorie: entier(req.body.matiere),
    nombre: entier(req.body.nombre) ?? 20,
  }, '/entrainement'),
);

// ---------- Révision ----------
routes.get('/revision', async (req, res) => {
  const progression = await progressionRevision(req.session.idUtilisateur);
  res.render('revision', { titre: 'Révision', progression, nombres: partie.NOMBRES });
});

routes.post('/revision', async (req, res) => {
  const annee = entier(req.body.annee);
  if (!annee) return res.redirect('/revision');
  return lancer(req, res, { mode: 'revision', annee, nombre: entier(req.body.nombre) ?? 20 }, '/revision');
});

routes.post('/revision/recommencer', async (req, res) => {
  const annee = entier(req.body.annee);
  const { affectedRows } = await requete('UPDATE revision_sessions SET active = 0 WHERE id_user = ? AND year = ? AND active = 1', [req.session.idUtilisateur, annee]);
  flash(req, 'succes', affectedRows ? `Révision ${annee} remise à zéro. L'ancienne progression reste dans l'historique.` : 'Rien à remettre à zéro.');
  res.redirect('/revision');
});

// ---------- Examen blanc ----------
routes.get('/examen', async (req, res) => {
  const [listeAnnees, passes] = await Promise.all([
    annees(),
    requete("SELECT year AS annee, MAX(score / (size * 2)) AS meilleur FROM training_sessions WHERE id_user = ? AND mode = 'examen' GROUP BY year", [req.session.idUtilisateur]),
  ]);
  const meilleurs = new Map(passes.map((p) => [p.annee, Math.round(p.meilleur * 100)]));
  res.render('examen', { titre: 'Examen blanc', annees: listeAnnees.map((a) => ({ ...a, meilleur: meilleurs.get(a.annee) ?? null })), secondes: partie.SECONDES_PAR_QUESTION_EXAMEN });
});

routes.post('/examen', (req, res) => lancer(req, res, { mode: 'examen', annee: entier(req.body.annee) }, '/examen'));

// ---------- Partie en cours ----------
async function cloturer(req, res, message) {
  const adresse = await partie.terminer(req);
  if (!adresse) {
    flash(req, 'attention', 'Aucune réponse donnée : la partie est abandonnée.');
    return res.redirect('/accueil');
  }
  if (message) flash(req, 'attention', message);
  res.redirect(adresse);
}

routes.get('/partie', async (req, res) => {
  const p = req.session.partie;
  if (!p) return res.redirect('/accueil');
  if (partie.depassee(p)) return cloturer(req, res, 'Temps écoulé : l’examen a été rendu automatiquement.');

  const reponses = partie.repondues(p);
  let index = req.query.q !== undefined ? Number.parseInt(req.query.q, 10) : (partie.suivante(p, -1) ?? 0);
  if (!(index >= 0 && index < p.ids.length)) index = 0;
  const q = await partie.question(p, index);
  if (!q) {
    // Question supprimée par l'administration pendant la partie : on la retire
    p.ids.splice(index, 1);
    const decalees = {};
    for (const [k, v] of Object.entries(p.reponses)) {
      const n = Number(k);
      if (n !== index) decalees[n > index ? n - 1 : n] = v;
    }
    p.reponses = decalees;
    if (!p.ids.length) delete req.session.partie;
    return res.redirect('/partie');
  }
  res.render('partie', {
    titre: `${partie.libelleMode(p.mode)} — question ${index + 1}`,
    p,
    q,
    index,
    choisies: (p.reponses[index] ?? '').split(',').filter(Boolean),
    nbRepondues: reponses.length,
    complete: reponses.length === p.ids.length,
    suivante: partie.suivante(p, index),
    libelleMode: partie.libelleMode(p.mode),
    restantMs: p.limite ? p.limite - Date.now() : null,
  });
});

routes.post('/partie/reponse', async (req, res) => {
  const p = req.session.partie;
  if (!p) return res.redirect('/accueil');
  if (partie.depassee(p)) return cloturer(req, res, 'Temps écoulé : l’examen a été rendu automatiquement.');
  const index = Number.parseInt(req.body.q, 10);
  if (!(index >= 0 && index < p.ids.length)) return res.redirect('/partie');
  const q = await ligne('SELECT type FROM qcm WHERE id_qcm = ?', [p.ids[index]]);
  partie.repondre(p, index, liste(req.body.reponse), q?.type);

  if (req.body.action === 'terminer') return cloturer(req, res);
  const prochaine = partie.suivante(p, index);
  res.redirect(`/partie?q=${prochaine ?? index}`);
});

routes.post('/partie/terminer', (req, res) => {
  if (!req.session.partie) return res.redirect('/accueil');
  return cloturer(req, res);
});

routes.post('/partie/abandonner', (req, res) => {
  delete req.session.partie;
  flash(req, 'succes', 'Partie abandonnée. Rien n’a été enregistré.');
  res.redirect('/accueil');
});

export default routes;
