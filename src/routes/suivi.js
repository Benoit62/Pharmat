// Historique, corrections détaillées et statistiques.
import { Router } from 'express';
import { requete, ligne } from '../bdd.js';
import { exigerConnexion } from '../securite.js';
import { entier } from '../outils.js';
import { activiteDe } from '../activite.js';
import { derniersJours, serieDeJours, format } from '../temps.js';
import { taux, arrondi } from '../notation.js';

const routes = Router();
routes.use(['/historique', '/statistiques'], exigerConnexion);
const PAR_PAGE = 25;

const MATIERES = `(SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ')
                     FROM qcms_categories qc JOIN categories c ON c.id_category = qc.category WHERE qc.qcm = q.id_qcm) AS matieres`;

/** Le propriétaire, ou l'administration (pour aider un compte). */
const peutVoir = (res, idProprietaire) => res.locals.utilisateur.id === idProprietaire || res.locals.utilisateur.admin;

// ---------- Historique ----------
routes.get('/historique', async (req, res) => {
  const id = req.session.idUtilisateur;
  const vue = ['series', 'examens', 'revisions'].includes(req.query.vue) ? req.query.vue : 'series';
  const page = entier(req.query.page) ?? 1;

  if (vue === 'revisions') {
    const passages = await requete(
      `SELECT r.id_revision, r.year AS annee, r.date, r.active, COUNT(a.id_revision_answer) AS faites, COALESCE(SUM(a.score), 0) AS points,
              (SELECT COUNT(*) FROM qcm q WHERE q.year = r.year AND q.annulee = 0) AS total
         FROM revision_sessions r LEFT JOIN revision_session_answers a ON a.id_revision = r.id_revision
        WHERE r.id_user = ? GROUP BY r.id_revision HAVING faites > 0 ORDER BY r.year DESC, r.id_revision DESC`,
      [id],
    );
    return res.render('historique', { titre: 'Historique', vue, passages, series: [], pages: 1, page: 1 });
  }

  const mode = vue === 'examens' ? 'examen' : 'entrainement';
  const [{ n }] = await requete('SELECT COUNT(*) AS n FROM training_sessions WHERE id_user = ? AND mode = ?', [id, mode]);
  const series = await requete(
    `SELECT s.id_session, s.date, s.year AS annee, s.size, s.score, s.duree_s, c.name AS matiere
       FROM training_sessions s LEFT JOIN categories c ON c.id_category = s.id_category
      WHERE s.id_user = ? AND s.mode = ? ORDER BY s.id_session DESC LIMIT ? OFFSET ?`,
    [id, mode, PAR_PAGE, (page - 1) * PAR_PAGE],
  );
  res.render('historique', { titre: 'Historique', vue, series, passages: [], page, pages: Math.max(1, Math.ceil(n / PAR_PAGE)) });
});

// ---------- Correction d'une série ou d'un examen ----------
routes.get('/historique/serie/:id', async (req, res, next) => {
  const serie = await ligne(
    `SELECT s.*, c.name AS matiere, u.name AS nom FROM training_sessions s
       JOIN users u ON u.id_user = s.id_user LEFT JOIN categories c ON c.id_category = s.id_category
      WHERE s.id_session = ?`,
    [entier(req.params.id)],
  );
  if (!serie || !peutVoir(res, serie.id_user)) return next(); // 404 : on ne dit pas qu'elle existe
  const questions = await requete(
    `SELECT a.answer AS reponse, a.score AS points, a.errors_number AS erreurs,
            q.id_qcm, q.year, q.number, q.type, q.question, q.A, q.B, q.C, q.D, q.E, q.correct, ${MATIERES}
       FROM training_session_answers a JOIN qcm q ON q.id_qcm = a.id_qcm
      WHERE a.id_session = ? ORDER BY a.id_session_answer`,
    [serie.id_session],
  );
  res.render('correction', {
    titre: serie.mode === 'examen' ? 'Correction de l’examen' : 'Correction de la série',
    surtitre: serie.mode === 'examen' ? `Examen blanc · ${serie.year}` : ['Entraînement', serie.year ?? 'toutes les annales', serie.matiere].filter(Boolean).join(' · '),
    date: serie.date,
    duree: serie.duree_s,
    score: arrondi(serie.score),
    nb: serie.size,
    questions,
    autreCompte: serie.id_user !== res.locals.utilisateur.id ? serie.nom : null,
    relance: serie.mode === 'entrainement' ? { annee: serie.year, matiere: serie.id_category, nombre: serie.size } : null,
    retour: { href: `/historique?vue=${serie.mode === 'examen' ? 'examens' : 'series'}`, texte: 'Historique' },
  });
});

// ---------- Correction d'une révision (toute l'année, ou la dernière étape) ----------
routes.get('/historique/revision/:id', async (req, res, next) => {
  const passage = await ligne(
    `SELECT r.*, u.name AS nom, (SELECT COUNT(*) FROM qcm q WHERE q.year = r.year AND q.annulee = 0) AS total
       FROM revision_sessions r JOIN users u ON u.id_user = r.id_user WHERE r.id_revision = ?`,
    [entier(req.params.id)],
  );
  if (!passage || !peutVoir(res, passage.id_user)) return next();
  const depuis = entier(req.query.depuis);
  const [toutes, questions] = await Promise.all([
    ligne('SELECT COUNT(*) AS faites, COALESCE(SUM(score), 0) AS points FROM revision_session_answers WHERE id_revision = ?', [passage.id_revision]),
    requete(
      `SELECT a.answer AS reponse, a.score AS points, a.errors AS erreurs,
              q.id_qcm, q.year, q.number, q.type, q.question, q.A, q.B, q.C, q.D, q.E, q.correct, ${MATIERES}
         FROM revision_session_answers a JOIN qcm q ON q.id_qcm = a.id_qcm
        WHERE a.id_revision = ? ${depuis ? 'AND a.cree_le >= FROM_UNIXTIME(?)' : ''}
        ORDER BY q.id_qcm`,
      depuis ? [passage.id_revision, depuis] : [passage.id_revision],
    ),
  ]);
  const scoreAffiche = questions.reduce((s, q) => s + q.points, 0);
  res.render('correction', {
    titre: depuis ? 'Correction de l’étape' : `Révision ${passage.year}`,
    surtitre: `Révision · annales ${passage.year}${passage.active ? '' : ' · progression terminée'}`,
    date: depuis ? null : passage.date,
    duree: null,
    score: arrondi(scoreAffiche),
    nb: questions.length,
    questions,
    progression: { faites: toutes.faites, total: passage.total, reussite: taux(Number(toutes.points), toutes.faites) },
    lienAnnee: depuis ? `/historique/revision/${passage.id_revision}` : null,
    autreCompte: passage.id_user !== res.locals.utilisateur.id ? passage.nom : null,
    continuer: passage.active && toutes.faites < passage.total ? passage.year : null,
    retour: { href: '/historique?vue=revisions', texte: 'Historique' },
  });
});

// ---------- Statistiques ----------
routes.get('/statistiques', async (req, res) => {
  const id = req.session.idUtilisateur;
  const [activite, series, matieres, types] = await Promise.all([
    activiteDe(id, 3650),
    requete('SELECT id_session, date, mode, size, score FROM training_sessions WHERE id_user = ? ORDER BY id_session DESC LIMIT 30', [id]),
    requete(
      `SELECT c.name AS nom, COUNT(*) AS n, SUM(x.score) AS points FROM (
          SELECT a.id_qcm, a.score FROM training_session_answers a JOIN training_sessions s ON s.id_session = a.id_session WHERE s.id_user = ?
          UNION ALL
          SELECT a.id_qcm, a.score FROM revision_session_answers a JOIN revision_sessions r ON r.id_revision = a.id_revision WHERE r.id_user = ?
        ) x JOIN qcms_categories qc ON qc.qcm = x.id_qcm JOIN categories c ON c.id_category = qc.category
        GROUP BY c.id_category HAVING n >= 5 ORDER BY SUM(x.score) / COUNT(*) ASC, n DESC`,
      [id, id],
    ),
    requete(
      `SELECT q.type, COUNT(*) AS n, SUM(x.score) AS points FROM (
          SELECT a.id_qcm, a.score FROM training_session_answers a JOIN training_sessions s ON s.id_session = a.id_session WHERE s.id_user = ?
          UNION ALL
          SELECT a.id_qcm, a.score FROM revision_session_answers a JOIN revision_sessions r ON r.id_revision = a.id_revision WHERE r.id_user = ?
        ) x JOIN qcm q ON q.id_qcm = x.id_qcm GROUP BY q.type`,
      [id, id],
    ),
  ]);

  let total = { questions: 0, points: 0 };
  for (const v of activite.values()) total = { questions: total.questions + v.questions, points: total.points + v.points };
  const trenteJours = derniersJours(30);
  res.render('statistiques', {
    titre: 'Statistiques',
    chiffres: {
      questions: total.questions,
      reussite: taux(total.points, total.questions),
      serie: serieDeJours([...activite.keys()]),
      joursActifs: trenteJours.filter((j) => activite.has(j)).length,
    },
    jours: derniersJours(14).map((j) => ({ jour: j, libelle: format.jourSemaine(j), questions: activite.get(j)?.questions ?? 0 })),
    series: series.reverse().map((s) => ({ ...s, reussite: taux(s.score, s.size) })),
    matieres: matieres.map((m) => ({ nom: m.nom, n: m.n, reussite: taux(Number(m.points), m.n) })),
    types: Object.fromEntries(types.map((t) => [t.type, { n: t.n, reussite: taux(Number(t.points), t.n) }])),
  });
});

export default routes;
