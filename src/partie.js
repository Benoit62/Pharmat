// La partie en cours : une série d'entraînement, une étape de révision ou un examen blanc.
// Elle vit dans la session (en base) : elle survit à un rechargement, à un redéploiement, et
// se reprend depuis un autre onglet. Rien n'est écrit dans l'historique avant la fin.
import { requete, ligne, transaction } from './bdd.js';
import { noter, lettres, arrondi } from './notation.js';
import { jour } from './temps.js';

export const SECONDES_PAR_QUESTION_EXAMEN = 90;
const GRACE_MS = 30e3; // le dernier envoi d'un examen peut arriver un peu après l'échéance
export const NOMBRES = [10, 20, 40, 60];

const MODES = {
  entrainement: 'Entraînement',
  revision: 'Révision',
  examen: 'Examen blanc',
};
export const libelleMode = (mode) => MODES[mode] ?? mode;

/** Révision « active » d'une année pour un compte (la progression en cours), ou null. */
export async function revisionActive(idUtilisateur, annee) {
  return ligne(
    'SELECT id_revision FROM revision_sessions WHERE id_user = ? AND year = ? AND active = 1 ORDER BY id_revision DESC LIMIT 1',
    [idUtilisateur, annee],
  );
}

/** Prépare une partie. Retourne un message d'erreur, ou null si la partie est créée. */
export async function creer(req, { mode, annee = null, categorie = null, nombre = 20 }) {
  const idUtilisateur = req.session.idUtilisateur;
  let ids;
  let libelle;

  if (mode === 'entrainement') {
    const filtres = ['q.annulee = 0'];
    const params = [];
    if (annee) { filtres.push('q.year = ?'); params.push(annee); }
    if (categorie) { filtres.push('EXISTS (SELECT 1 FROM qcms_categories qc WHERE qc.qcm = q.id_qcm AND qc.category = ?)'); params.push(categorie); }
    const lignes = await requete(
      `SELECT q.id_qcm FROM qcm q WHERE ${filtres.join(' AND ')} ORDER BY RAND() LIMIT ?`,
      [...params, Math.min(Math.max(nombre, 5), 100)],
    );
    ids = lignes.map((l) => l.id_qcm);
    const matiere = categorie ? (await ligne('SELECT name FROM categories WHERE id_category = ?', [categorie]))?.name : null;
    libelle = [annee ?? 'Toutes les annales', matiere].filter(Boolean).join(' · ');
    if (!ids.length) return 'Aucune question ne correspond à ce choix.';
  } else if (mode === 'revision') {
    const active = await revisionActive(idUtilisateur, annee);
    const lignes = await requete(
      `SELECT q.id_qcm FROM qcm q WHERE q.year = ? AND q.annulee = 0
         AND NOT EXISTS (SELECT 1 FROM revision_session_answers a WHERE a.id_revision = ? AND a.id_qcm = q.id_qcm)
       ORDER BY q.id_qcm LIMIT ?`,
      [annee, active?.id_revision ?? 0, Math.min(Math.max(nombre, 5), 120)],
    );
    ids = lignes.map((l) => l.id_qcm);
    libelle = `Annales ${annee}`;
    if (!ids.length) return `Tu as répondu à toutes les questions de ${annee}. Recommence l'année pour la refaire.`;
  } else if (mode === 'examen') {
    const lignes = await requete('SELECT id_qcm FROM qcm WHERE year = ? AND annulee = 0 ORDER BY id_qcm', [annee]);
    ids = lignes.map((l) => l.id_qcm);
    libelle = `Annales ${annee}`;
    if (!ids.length) return 'Aucune question pour cette année.';
  } else {
    return 'Mode inconnu.';
  }

  const debut = Date.now();
  req.session.partie = {
    mode,
    annee,
    categorie,
    libelle,
    ids,
    reponses: {},
    debut,
    limite: mode === 'examen' ? debut + ids.length * SECONDES_PAR_QUESTION_EXAMEN * 1000 : null,
  };
  return null;
}

export function depassee(partie) {
  return Boolean(partie?.limite && Date.now() > partie.limite + GRACE_MS);
}

/** Index des questions déjà répondues. */
export function repondues(partie) {
  return Object.keys(partie.reponses).map(Number);
}

/** Prochaine question sans réponse après l'index donné (en boucle), ou null s'il n'y en a plus. */
export function suivante(partie, depuis) {
  const n = partie.ids.length;
  for (let i = 1; i <= n; i++) {
    const j = (depuis + i) % n;
    if (!(j in partie.reponses)) return j;
  }
  return null;
}

/** Une question de la partie, avec ses matières. */
export async function question(partie, index) {
  return ligne(
    `SELECT q.id_qcm, q.year, q.number, q.type, q.question, q.A, q.B, q.C, q.D, q.E,
            GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') AS matieres
       FROM qcm q
       LEFT JOIN qcms_categories qc ON qc.qcm = q.id_qcm
       LEFT JOIN categories c ON c.id_category = qc.category
      WHERE q.id_qcm = ?
      GROUP BY q.id_qcm`,
    [partie.ids[index]],
  );
}

/** Enregistre la réponse donnée à la question `index` (lettres A-E). */
export function repondre(partie, index, reponse, type) {
  let choix = lettres(reponse);
  if (type === 'QCS') choix = choix.slice(0, 1);
  if (choix.length) partie.reponses[index] = choix.join(',');
  else delete partie.reponses[index];
}

/**
 * Clôt la partie : note les réponses, les écrit dans l'historique, vide la session.
 * Entraînement : seules les questions répondues comptent. Examen : une question sans réponse
 * vaut 0. Révision : les réponses rejoignent la progression de l'année ; les questions
 * laissées de côté restent à faire.
 * Retourne l'adresse où voir la correction, ou null si rien n'a été répondu.
 */
export async function terminer(req) {
  const p = req.session.partie;
  delete req.session.partie;
  const idUtilisateur = req.session.idUtilisateur;

  const indexes = p.mode === 'examen' ? p.ids.map((_, i) => i) : repondues(p).sort((a, b) => a - b);
  if (!indexes.length) return null;
  const qcm = new Map(
    (await requete('SELECT id_qcm, type, correct FROM qcm WHERE id_qcm IN (?)', [p.ids])).map((q) => [q.id_qcm, q]),
  );
  const notes = indexes
    .filter((i) => qcm.has(p.ids[i])) // une question supprimée entre-temps est ignorée
    .map((i) => {
      const q = qcm.get(p.ids[i]);
      const reponse = p.reponses[i] ?? '';
      return { id: q.id_qcm, reponse, ...noter(q.type, q.correct, reponse) };
    });
  if (!notes.length) return null;

  if (p.mode === 'revision') {
    const idRevision = await transaction(async (t) => {
      const active = (await t.requete(
        'SELECT id_revision FROM revision_sessions WHERE id_user = ? AND year = ? AND active = 1 ORDER BY id_revision DESC LIMIT 1 FOR UPDATE',
        [idUtilisateur, p.annee],
      ))[0];
      const id = active?.id_revision ?? (await t.requete(
        'INSERT INTO revision_sessions (id_user, date, year, active) VALUES (?, ?, ?, 1)',
        [idUtilisateur, jour(), p.annee],
      )).insertId;
      await t.requete(
        'INSERT IGNORE INTO revision_session_answers (id_revision, id_qcm, answer, score, errors) VALUES ?',
        [notes.map((n) => [id, n.id, n.reponse, n.points, n.erreurs])],
      );
      return id;
    });
    return `/historique/revision/${idRevision}?depuis=${Math.floor(p.debut / 1000)}`;
  }

  const score = arrondi(notes.reduce((s, n) => s + n.points, 0));
  const idSerie = await transaction(async (t) => {
    const { insertId } = await t.requete(
      'INSERT INTO training_sessions (id_user, mode, size, score, date, year, id_category, duree_s) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [idUtilisateur, p.mode, notes.length, score, jour(), p.annee, p.categorie, Math.round((Date.now() - p.debut) / 1000)],
    );
    await t.requete(
      'INSERT INTO training_session_answers (id_session, id_qcm, answer, score, errors_number) VALUES ?',
      [notes.map((n) => [insertId, n.id, n.reponse, n.points, n.erreurs])],
    );
    return insertId;
  });
  return `/historique/serie/${idSerie}`;
}
