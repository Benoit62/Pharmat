// Administration : comptes, questions (modifier, supprimer, ajouter), import et export.
import { Router } from 'express';
import { requete, ligne, transaction } from '../bdd.js';
import { exigerAdmin } from '../securite.js';
import { flash, entier, texte, liste } from '../outils.js';
import { magasin } from '../sessions.js';
import { actif as courrielActif, courriels } from '../courriel.js';
import { evenement } from '../evenement.js';
import { lettres, taux, LETTRES } from '../notation.js';
import { jour } from '../temps.js';

const routes = Router();
routes.use(exigerAdmin);
const PAR_PAGE = 30;

// ---------- Tableau de bord et comptes ----------
routes.get('/', async (req, res) => {
  const [chiffres, comptes] = await Promise.all([
    ligne(
      `SELECT (SELECT COUNT(*) FROM users) AS comptes,
              (SELECT COUNT(*) FROM users WHERE last_login >= UTC_TIMESTAMP() - INTERVAL 7 DAY) AS actifs,
              (SELECT COUNT(*) FROM training_sessions WHERE date >= CURDATE() - INTERVAL 7 DAY) AS series,
              (SELECT COUNT(*) FROM qcm WHERE annulee = 0) AS questions`,
    ),
    requete(
      `SELECT u.id_user, u.name, u.mail, u.status, u.last_login, u.confirm_id IS NOT NULL AS en_attente,
              (SELECT COUNT(*) FROM training_sessions s WHERE s.id_user = u.id_user) AS series
         FROM users u ORDER BY u.last_login IS NULL, u.last_login DESC`,
    ),
  ]);
  res.render('admin/tableau', { titre: 'Administration', chiffres, comptes });
});

routes.get('/utilisateurs/:id', async (req, res, next) => {
  const id = entier(req.params.id);
  const compte = await ligne('SELECT id_user, name, mail, status, last_login, cree_le, confirm_id IS NOT NULL AS en_attente, notif_rappel, notif_bilan FROM users WHERE id_user = ?', [id]);
  if (!compte) return next();
  const [series, revisions] = await Promise.all([
    requete('SELECT id_session, mode, date, year, size, score FROM training_sessions WHERE id_user = ? ORDER BY id_session DESC LIMIT 20', [id]),
    requete(
      `SELECT r.id_revision, r.year, r.active, COUNT(a.id_revision_answer) AS faites, COALESCE(SUM(a.score), 0) AS points
         FROM revision_sessions r LEFT JOIN revision_session_answers a ON a.id_revision = r.id_revision
        WHERE r.id_user = ? GROUP BY r.id_revision HAVING faites > 0 ORDER BY r.id_revision DESC`,
      [id],
    ),
  ]);
  res.render('admin/compte', {
    titre: compte.name,
    compte,
    series: series.map((s) => ({ ...s, reussite: taux(s.score, s.size) })),
    revisions: revisions.map((r) => ({ ...r, reussite: taux(Number(r.points), r.faites) })),
  });
});

/** Actions sur un compte ; jamais sur le sien (on ne se retire pas l'administration par mégarde). */
async function compteCible(req, res) {
  const id = entier(req.params.id);
  if (id === res.locals.utilisateur.id) {
    flash(req, 'erreur', 'Cette action ne s’applique pas à ton propre compte.');
    res.redirect(`/admin/utilisateurs/${id}`);
    return null;
  }
  const compte = await ligne('SELECT id_user, name, mail, status, confirm_id FROM users WHERE id_user = ?', [id]);
  if (!compte) res.redirect('/admin');
  return compte;
}

routes.post('/utilisateurs/:id/role', async (req, res) => {
  const c = await compteCible(req, res);
  if (!c) return;
  const role = c.status === 'ADMIN' ? 'USER' : 'ADMIN';
  await requete('UPDATE users SET status = ? WHERE id_user = ?', [role, c.id_user]);
  flash(req, 'succes', role === 'ADMIN' ? `${c.name} administre désormais Pharmat.` : `${c.name} n’administre plus Pharmat.`);
  res.redirect(`/admin/utilisateurs/${c.id_user}`);
});

routes.post('/utilisateurs/:id/confirmer', async (req, res) => {
  const c = await compteCible(req, res);
  if (!c) return;
  await requete('UPDATE users SET confirm_id = NULL WHERE id_user = ?', [c.id_user]);
  flash(req, 'succes', `Adresse de ${c.name} confirmée.`);
  res.redirect(`/admin/utilisateurs/${c.id_user}`);
});

routes.post('/utilisateurs/:id/relancer', async (req, res) => {
  const c = await compteCible(req, res);
  if (!c) return;
  const ok = courrielActif && (await courriels.rappel(c, {
    sujet: 'On t’attend sur Pharmat',
    titre: `Une petite série, ${c.name} ?`,
    paragraphes: ['Ça fait un moment qu’on ne t’a pas vu. Quelques questions suffisent pour garder le rythme.'],
    bouton: 'Reprendre',
  }));
  flash(req, ok ? 'succes' : 'erreur', ok ? `Relance envoyée à ${c.name}.` : 'Le courriel n’a pas pu partir.');
  res.redirect(`/admin/utilisateurs/${c.id_user}`);
});

routes.post('/utilisateurs/:id/supprimer', async (req, res) => {
  const c = await compteCible(req, res);
  if (!c) return;
  await requete('DELETE FROM users WHERE id_user = ?', [c.id_user]);
  await magasin.fermerPourUtilisateur(c.id_user);
  evenement('info', 'Compte supprimé par l’administration', { compte: c.id_user });
  flash(req, 'succes', `Le compte de ${c.name} et son historique ont été supprimés.`);
  res.redirect('/admin');
});

// ---------- Questions ----------
const toutesMatieres = () => requete('SELECT id_category AS id, name AS nom FROM categories ORDER BY name');

routes.get('/questions', async (req, res) => {
  const annee = entier(req.query.annee);
  const recherche = texte(req.query.q, 100);
  const page = entier(req.query.page) ?? 1;
  const filtres = [];
  const params = [];
  if (annee) { filtres.push('q.year = ?'); params.push(annee); }
  if (recherche) { filtres.push('(q.question LIKE ? OR q.A LIKE ? OR q.B LIKE ? OR q.C LIKE ? OR q.D LIKE ? OR q.E LIKE ?)'); params.push(...Array(6).fill(`%${recherche}%`)); }
  const where = filtres.length ? `WHERE ${filtres.join(' AND ')}` : '';
  const [annees, [{ n }], questions] = await Promise.all([
    requete('SELECT year AS annee, COUNT(*) AS n FROM qcm GROUP BY year ORDER BY year DESC'),
    requete(`SELECT COUNT(*) AS n FROM qcm q ${where}`, params),
    requete(
      `SELECT q.id_qcm, q.year, q.number, q.type, q.question, q.correct, q.annulee,
              (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM qcms_categories qc JOIN categories c ON c.id_category = qc.category WHERE qc.qcm = q.id_qcm) AS matieres
         FROM qcm q ${where} ORDER BY q.year DESC, q.id_qcm LIMIT ? OFFSET ?`,
      [...params, PAR_PAGE, (page - 1) * PAR_PAGE],
    ),
  ]);
  res.render('admin/questions', { titre: 'Questions', annees, questions, annee, recherche, page, pages: Math.max(1, Math.ceil(n / PAR_PAGE)), total: n });
});

routes.get('/questions/nouvelle', async (req, res) => {
  const annee = entier(req.query.annee) ?? new Date().getFullYear();
  const suivant = await ligne('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM qcm WHERE year = ?', [annee]);
  res.render('admin/question', {
    titre: 'Nouvelle question',
    q: { id_qcm: null, year: annee, number: suivant.n, type: 'QCM', question: '', A: '', B: '', C: '', D: '', E: '', correct: '', annulee: 0 },
    choisies: [],
    matieres: await toutesMatieres(),
  });
});

routes.get('/questions/:id', async (req, res, next) => {
  const q = await ligne('SELECT * FROM qcm WHERE id_qcm = ?', [entier(req.params.id)]);
  if (!q) return next();
  const choisies = (await requete('SELECT category FROM qcms_categories WHERE qcm = ?', [q.id_qcm])).map((l) => l.category);
  res.render('admin/question', { titre: `Question ${q.number} · ${q.year}`, q, choisies, matieres: await toutesMatieres() });
});

/** Lit et vérifie une question (formulaire ou import). Retourne { erreur } ou { question }. */
function lireQuestion(brut) {
  const annee = entier(brut.annee);
  const numero = entier(brut.numero);
  const type = String(brut.type ?? '').toUpperCase();
  const textes = Object.fromEntries(LETTRES.map((l) => [l, texte(brut[l] ?? brut[`qcm${l}`], 5000)]));
  const enonce = texte(brut.question, 5000);
  const annulee = brut.annulee === true || brut.annulee === 'oui' || /annul/i.test(String(brut.correction ?? ''));
  const correction = Array.isArray(brut.correction) ? brut.correction : String(brut.correction ?? '').split(/[\s,;]*/);
  const correctes = annulee ? [] : lettres(correction);
  const max = new Date().getFullYear() + 1;
  if (!annee || annee < 1980 || annee > max) return { erreur: 'année absente ou invalide' };
  if (!numero) return { erreur: 'numéro absent' };
  if (!['QCM', 'QCS'].includes(type)) return { erreur: 'type attendu : QCM ou QCS' };
  if (!enonce) return { erreur: 'énoncé vide' };
  if (LETTRES.some((l) => !textes[l])) return { erreur: 'il faut les cinq propositions A à E' };
  if (!annulee && !correctes.length) return { erreur: 'aucune bonne réponse' };
  if (type === 'QCS' && !annulee && correctes.length !== 1) return { erreur: 'un QCS a une seule bonne réponse' };
  let matieres = brut.categorie ?? brut.matieres ?? [];
  if (typeof matieres === 'string') matieres = matieres.split('-');
  matieres = [...new Set(matieres.map((m) => texte(String(m), 40)).filter(Boolean))];
  return { question: { annee, numero, type, enonce, ...textes, correct: correctes.join(','), annulee: annulee ? 1 : 0, matieres } };
}

/**
 * Écrit une question et ses matières (créées au besoin) dans une transaction.
 * `garderMatieres` : une question importée sans matière garde celles qu'elle avait.
 */
async function ecrire(t, id, q, garderMatieres = false) {
  const valeurs = [q.annee, q.type, q.numero, q.enonce, q.A, q.B, q.C, q.D, q.E, q.correct, q.annulee];
  if (id) {
    await t.requete('UPDATE qcm SET year = ?, type = ?, number = ?, question = ?, A = ?, B = ?, C = ?, D = ?, E = ?, correct = ?, annulee = ? WHERE id_qcm = ?', [...valeurs, id]);
    if (garderMatieres && !q.matieres.length) return id;
    await t.requete('DELETE FROM qcms_categories WHERE qcm = ?', [id]);
  } else {
    id = (await t.requete('INSERT INTO qcm (year, type, number, question, A, B, C, D, E, correct, annulee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', valeurs)).insertId;
  }
  for (const nom of q.matieres) {
    await t.requete('INSERT IGNORE INTO categories (name) VALUES (?)', [nom]);
    await t.requete('INSERT IGNORE INTO qcms_categories (qcm, category) SELECT ?, id_category FROM categories WHERE name = ?', [id, nom]);
  }
  return id;
}

routes.post('/questions/:id', async (req, res) => {
  const id = req.params.id === 'nouvelle' ? null : entier(req.params.id);
  const ids = liste(req.body.matieres).map(entier).filter(Boolean);
  const noms = ids.length ? (await requete('SELECT name FROM categories WHERE id_category IN (?)', [ids])).map((m) => m.name) : [];
  const nouvelle = texte(req.body.nouvelle_matiere, 40);
  const lu = lireQuestion({ ...req.body, correction: liste(req.body.correctes), matieres: [...noms, nouvelle], annulee: req.body.annulee });
  if (lu.erreur) {
    flash(req, 'erreur', `Question non enregistrée : ${lu.erreur}.`);
    return res.redirect(id ? `/admin/questions/${id}` : '/admin/questions/nouvelle');
  }
  const idFinal = await transaction((t) => ecrire(t, id, lu.question));
  flash(req, 'succes', id ? 'Question enregistrée.' : 'Question ajoutée.');
  res.redirect(`/admin/questions?annee=${lu.question.annee}#q${idFinal}`);
});

routes.post('/questions/:id/supprimer', async (req, res) => {
  const q = await ligne('SELECT id_qcm, year, number FROM qcm WHERE id_qcm = ?', [entier(req.params.id)]);
  if (q) {
    // Les réponses données à cette question disparaissent avec elle (ON DELETE CASCADE) ; les
    // scores des séries passées restent ceux du jour.
    await requete('DELETE FROM qcm WHERE id_qcm = ?', [q.id_qcm]);
    await requete('DELETE FROM categories WHERE id_category NOT IN (SELECT category FROM qcms_categories)');
    flash(req, 'succes', `Question ${q.number} de ${q.year} supprimée.`);
  }
  res.redirect(`/admin/questions${q ? `?annee=${q.year}` : ''}`);
});

// ---------- Import et export (format des fichiers .seqa de Pharmat 1) ----------
routes.get('/import', async (req, res) => {
  const annees = await requete('SELECT year AS annee, COUNT(*) AS n FROM qcm GROUP BY year ORDER BY year DESC');
  res.render('admin/import', { titre: 'Importer et exporter', annees });
});

routes.post('/questions-import', async (req, res) => {
  const lot = Array.isArray(req.body?.questions) ? req.body.questions.slice(0, 5000) : null;
  if (!lot) return res.status(400).json({ message: 'Fichier illisible : une liste de questions est attendue.' });
  const rapport = { ajoutees: 0, modifiees: 0, refusees: [] };
  await transaction(async (t) => {
    for (const [i, brut] of lot.entries()) {
      const lu = lireQuestion(brut ?? {});
      if (lu.erreur) {
        rapport.refusees.push({ rang: i + 1, raison: lu.erreur });
        continue;
      }
      const q = lu.question;
      // Même année, même numéro et même énoncé : c'est une mise à jour
      const existante = (await t.requete('SELECT id_qcm FROM qcm WHERE year = ? AND number = ? AND question = ? LIMIT 1', [q.annee, q.numero, q.enonce]))[0];
      await ecrire(t, existante?.id_qcm ?? null, q, true);
      rapport[existante ? 'modifiees' : 'ajoutees']++;
    }
  });
  evenement('info', 'Questions importées', { ajoutees: rapport.ajoutees, modifiees: rapport.modifiees, refusees: rapport.refusees.length });
  res.json(rapport);
});

routes.get('/questions-export', async (req, res) => {
  const annee = entier(req.query.annee);
  const lignes = await requete(
    `SELECT q.*, (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR '-') FROM qcms_categories qc JOIN categories c ON c.id_category = qc.category WHERE qc.qcm = q.id_qcm) AS matieres
       FROM qcm q ${annee ? 'WHERE q.year = ?' : ''} ORDER BY q.year, q.id_qcm`,
    annee ? [annee] : [],
  );
  const questions = lignes.map((q) => ({
    annee: q.year, numero: q.number, type: q.type, question: q.question,
    qcmA: q.A, qcmB: q.B, qcmC: q.C, qcmD: q.D, qcmE: q.E,
    correction: q.annulee ? 'ANNULÉ' : q.correct.replaceAll(',', ''),
    categorie: q.matieres ?? '',
  }));
  res.attachment(`pharmat-${annee ?? 'annales'}-${jour()}.json`);
  res.json({ format: 'pharmat/1', exporte_le: new Date().toISOString(), questions });
});

export default routes;
