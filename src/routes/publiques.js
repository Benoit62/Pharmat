// Pages ouvertes à tous : présentation, connexion, inscription, confirmation d'adresse,
// mot de passe oublié, désinscription des rappels.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { requete, ligne } from '../bdd.js';
import { limiteur, retourSur } from '../securite.js';
import { actif as courrielActif, courriels, verifierDesinscription } from '../courriel.js';
import { evenement } from '../evenement.js';
import { flash, texte, entier, ouvrirSession } from '../outils.js';
import { magasin } from '../sessions.js';

const routes = Router();
const COUT_BCRYPT = 11;
// Empreinte factice : un compte inexistant coûte le même temps de calcul qu'un vrai
const FACTICE = bcrypt.hashSync('pharmat', COUT_BCRYPT);
const essaisConnexion = limiteur(10, 15 * 60e3);
const essaisEnvoi = limiteur(5, 60 * 60e3);

const RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_NOM = /^[\p{L}][\p{L}' -]{1,29}$/u;

function verifierMotDePasse(mdp, confirmation) {
  if (mdp.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (Buffer.byteLength(mdp) > 72) return 'Le mot de passe est trop long (72 octets au plus).';
  if (confirmation !== undefined && mdp !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}
export { verifierMotDePasse, COUT_BCRYPT };

const empreinte = (jeton) => createHash('sha256').update(jeton).digest('hex');

routes.get('/', async (req, res) => {
  if (res.locals.utilisateur) return res.redirect('/accueil');
  const chiffres = await ligne(
    'SELECT COUNT(*) AS questions, COUNT(DISTINCT year) AS annales, MIN(year) AS debut, MAX(year) AS fin FROM qcm WHERE annulee = 0',
  );
  res.render('index', { titre: null, chiffres });
});

// ---------- Connexion ----------
routes.get('/connexion', (req, res) => {
  if (res.locals.utilisateur) return res.redirect('/accueil');
  res.render('connexion', { titre: 'Connexion', retour: retourSur(req.query.retour), mail: '' });
});

routes.post('/connexion', async (req, res) => {
  const mail = texte(req.body.mail, 190).toLowerCase();
  const mdp = typeof req.body.mot_de_passe === 'string' ? req.body.mot_de_passe : '';
  const retour = retourSur(req.body.retour);
  const page = (message) => res.status(400).render('connexion', { titre: 'Connexion', retour, mail, erreur: message });

  if (!essaisConnexion(`${req.ip}|${mail}`)) return page('Trop de tentatives. Réessaie dans un quart d’heure.');
  const u = await ligne('SELECT id_user, password, confirm_id FROM users WHERE mail = ?', [mail]);
  // Même réponse que le compte existe ou non, et un temps de calcul comparable
  const ok = await bcrypt.compare(mdp, u?.password ?? FACTICE);
  if (!u || !ok) return page('Adresse ou mot de passe incorrect.');
  if (u.confirm_id && courrielActif) {
    return res.status(403).render('connexion', { titre: 'Connexion', retour, mail, nonConfirme: true });
  }
  await ouvrirSession(req, u.id_user);
  await requete('UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id_user = ?', [u.id_user]);
  res.redirect(retour);
});

routes.post('/deconnexion', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('pharmat');
    res.redirect('/');
  });
});

// ---------- Inscription ----------
routes.get('/inscription', (req, res) => {
  if (res.locals.utilisateur) return res.redirect('/accueil');
  res.render('inscription', { titre: 'Inscription', valeurs: {} });
});

routes.post('/inscription', async (req, res) => {
  const valeurs = { mail: texte(req.body.mail, 190).toLowerCase(), nom: texte(req.body.nom, 30) };
  const mdp = typeof req.body.mot_de_passe === 'string' ? req.body.mot_de_passe : '';
  const page = (erreur) => res.status(400).render('inscription', { titre: 'Inscription', valeurs, erreur });

  if (!RE_MAIL.test(valeurs.mail)) return page('Cette adresse ne semble pas valide.');
  if (!RE_NOM.test(valeurs.nom)) return page('Le prénom doit faire de 2 à 30 lettres (espaces, tirets et apostrophes permis).');
  const erreurMdp = verifierMotDePasse(mdp, req.body.confirmation);
  if (erreurMdp) return page(erreurMdp);
  if (!essaisEnvoi(`inscription|${req.ip}`)) return page('Trop d’inscriptions depuis cette connexion. Réessaie plus tard.');

  const existant = await ligne('SELECT id_user FROM users WHERE mail = ?', [valeurs.mail]);
  if (existant) return page('Un compte existe déjà avec cette adresse. Connecte-toi, ou demande un nouveau mot de passe.');

  const hache = await bcrypt.hash(mdp, COUT_BCRYPT);
  // Sans courriel configuré, l'adresse ne peut pas être vérifiée : le compte est ouvert d'office
  const idConfirmation = courrielActif ? randomUUID() : null;
  const { insertId } = await requete(
    'INSERT INTO users (name, mail, password, confirm_id, status) VALUES (?, ?, ?, ?, ?)',
    [valeurs.nom, valeurs.mail, hache, idConfirmation, 'USER'],
  );
  evenement('info', 'Nouveau compte', { compte: insertId });

  if (idConfirmation) {
    await courriels.confirmation({ name: valeurs.nom, mail: valeurs.mail }, idConfirmation);
    return res.render('message', {
      titre: 'Vérifie ta boîte',
      symbole: 'mail',
      texte: `Nous avons envoyé un lien de confirmation à ${valeurs.mail}. Clique dessus pour ouvrir ton compte.`,
    });
  }
  await ouvrirSession(req, insertId);
  await requete('UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id_user = ?', [insertId]);
  flash(req, 'succes', `Bienvenue, ${valeurs.nom}. Lance ta première série quand tu veux.`);
  res.redirect('/accueil');
});

// ---------- Confirmation de l'adresse ----------
routes.get('/confirmation/:id', async (req, res) => {
  const id = texte(req.params.id, 36);
  const u = id ? await ligne('SELECT id_user, name FROM users WHERE confirm_id = ?', [id]) : null;
  if (!u) {
    return res.status(404).render('message', {
      titre: 'Lien périmé',
      symbole: 'triangle-alert',
      texte: 'Ce lien ne correspond à aucun compte en attente. Si ton adresse est déjà confirmée, connecte-toi simplement.',
      lien: { href: '/connexion', texte: 'Se connecter' },
    });
  }
  await requete('UPDATE users SET confirm_id = NULL WHERE id_user = ?', [u.id_user]);
  await ouvrirSession(req, u.id_user);
  await requete('UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id_user = ?', [u.id_user]);
  flash(req, 'succes', `Adresse confirmée. Bienvenue, ${u.name}.`);
  res.redirect('/accueil');
});

routes.post('/confirmation/renvoyer', async (req, res) => {
  const mail = texte(req.body.mail, 190).toLowerCase();
  if (courrielActif && essaisEnvoi(`confirmation|${req.ip}`)) {
    const u = await ligne('SELECT name, mail, confirm_id FROM users WHERE mail = ? AND confirm_id IS NOT NULL', [mail]);
    if (u) await courriels.confirmation(u, u.confirm_id);
  }
  res.render('message', { titre: 'Lien renvoyé', symbole: 'mail', texte: 'Si un compte attend une confirmation à cette adresse, un nouveau lien vient de partir.' });
});

// ---------- Mot de passe oublié ----------
routes.get('/mot-de-passe-oublie', (req, res) => {
  if (!courrielActif) return res.redirect('/connexion');
  res.render('oubli', { titre: 'Mot de passe oublié' });
});

routes.post('/mot-de-passe-oublie', async (req, res) => {
  if (!courrielActif) return res.redirect('/connexion');
  const mail = texte(req.body.mail, 190).toLowerCase();
  if (essaisEnvoi(`oubli|${req.ip}`)) {
    const u = await ligne('SELECT id_user, name, mail FROM users WHERE mail = ?', [mail]);
    if (u) {
      const jeton = randomBytes(32).toString('base64url');
      await requete(
        'UPDATE users SET reinit_empreinte = ?, reinit_expire = UTC_TIMESTAMP() + INTERVAL 1 HOUR WHERE id_user = ?',
        [empreinte(jeton), u.id_user],
      );
      await courriels.reinitialisation(u, jeton);
    }
  }
  // Même réponse dans tous les cas : on ne révèle pas quelles adresses ont un compte
  res.render('message', { titre: 'Vérifie ta boîte', symbole: 'mail', texte: 'Si un compte existe à cette adresse, un lien pour choisir un nouveau mot de passe vient de partir. Il est valable une heure.' });
});

async function compteDuJeton(jeton) {
  if (!jeton || jeton.length > 64) return null;
  return ligne('SELECT id_user FROM users WHERE reinit_empreinte = ? AND reinit_expire > UTC_TIMESTAMP()', [empreinte(jeton)]);
}

routes.get('/reinitialiser/:jeton', async (req, res) => {
  const u = await compteDuJeton(req.params.jeton);
  if (!u) return res.status(404).render('message', { titre: 'Lien périmé', symbole: 'triangle-alert', texte: 'Ce lien a expiré ou a déjà servi. Fais une nouvelle demande.', lien: { href: '/mot-de-passe-oublie', texte: 'Nouvelle demande' } });
  res.render('reinitialiser', { titre: 'Nouveau mot de passe', jeton: req.params.jeton });
});

routes.post('/reinitialiser/:jeton', async (req, res) => {
  const u = await compteDuJeton(req.params.jeton);
  if (!u) return res.redirect(`/reinitialiser/${encodeURIComponent(req.params.jeton)}`);
  const mdp = typeof req.body.mot_de_passe === 'string' ? req.body.mot_de_passe : '';
  const erreur = verifierMotDePasse(mdp, req.body.confirmation);
  if (erreur) return res.status(400).render('reinitialiser', { titre: 'Nouveau mot de passe', jeton: req.params.jeton, erreur });
  await requete(
    'UPDATE users SET password = ?, reinit_empreinte = NULL, reinit_expire = NULL, confirm_id = NULL WHERE id_user = ?',
    [await bcrypt.hash(mdp, COUT_BCRYPT), u.id_user],
  );
  await magasin.fermerPourUtilisateur(u.id_user);
  await ouvrirSession(req, u.id_user);
  flash(req, 'succes', 'Mot de passe changé. Tes autres connexions ont été fermées.');
  res.redirect('/accueil');
});

// ---------- Désinscription des rappels (lien en pied de courriel, sans connexion) ----------
async function desinscrire(req, res) {
  const id = entier(req.params.id);
  if (!id || !verifierDesinscription(id, req.params.jeton)) {
    return res.status(404).render('message', { titre: 'Lien invalide', symbole: 'triangle-alert', texte: 'Ce lien de désinscription est incomplet.' });
  }
  await requete('UPDATE users SET notif_rappel = 0, notif_bilan = 0 WHERE id_user = ?', [id]);
  if (req.method === 'POST') return res.sendStatus(200); // désinscription en un clic (RFC 8058)
  res.render('message', { titre: 'C’est noté', symbole: 'circle-check', texte: 'Tu ne recevras plus de rappels ni de bilan. Tu peux les réactiver à tout moment depuis ton compte.', lien: { href: '/compte', texte: 'Mon compte' } });
}
routes.get('/desinscription/:id/:jeton', desinscrire);
routes.post('/desinscription/:id/:jeton', desinscrire);

export default routes;
