// Mon compte : prénom, courriels de rappel, mot de passe, suppression du compte.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requete, ligne } from '../bdd.js';
import { exigerConnexion } from '../securite.js';
import { flash, texte } from '../outils.js';
import { magasin } from '../sessions.js';
import { evenement } from '../evenement.js';
import { verifierMotDePasse, COUT_BCRYPT } from './publiques.js';

const routes = Router();
routes.use('/compte', exigerConnexion);

const RE_NOM = /^[\p{L}][\p{L}' -]{1,29}$/u;

routes.get('/compte', async (req, res) => {
  const compte = await ligne(
    `SELECT name, mail, notif_rappel, notif_bilan, cree_le,
            (SELECT COUNT(*) FROM training_sessions WHERE id_user = u.id_user) AS series
       FROM users u WHERE id_user = ?`,
    [req.session.idUtilisateur],
  );
  res.render('compte', { titre: 'Mon compte', compte });
});

routes.post('/compte/profil', async (req, res) => {
  const nom = texte(req.body.nom, 30);
  if (!RE_NOM.test(nom)) flash(req, 'erreur', 'Le prénom doit faire de 2 à 30 lettres.');
  else {
    await requete('UPDATE users SET name = ? WHERE id_user = ?', [nom, req.session.idUtilisateur]);
    flash(req, 'succes', 'Prénom enregistré.');
  }
  res.redirect('/compte');
});

routes.post('/compte/courriels', async (req, res) => {
  await requete('UPDATE users SET notif_rappel = ?, notif_bilan = ? WHERE id_user = ?', [
    req.body.rappel === 'oui' ? 1 : 0,
    req.body.bilan === 'oui' ? 1 : 0,
    req.session.idUtilisateur,
  ]);
  flash(req, 'succes', 'Préférences de courriel enregistrées.');
  res.redirect('/compte#courriels');
});

async function verifierActuel(req) {
  const u = await ligne('SELECT password FROM users WHERE id_user = ?', [req.session.idUtilisateur]);
  return bcrypt.compare(typeof req.body.actuel === 'string' ? req.body.actuel : '', u.password);
}

routes.post('/compte/mot-de-passe', async (req, res) => {
  const nouveau = typeof req.body.mot_de_passe === 'string' ? req.body.mot_de_passe : '';
  const erreur = verifierMotDePasse(nouveau, req.body.confirmation);
  if (!(await verifierActuel(req))) flash(req, 'erreur', 'Le mot de passe actuel est incorrect.');
  else if (erreur) flash(req, 'erreur', erreur);
  else {
    await requete('UPDATE users SET password = ? WHERE id_user = ?', [await bcrypt.hash(nouveau, COUT_BCRYPT), req.session.idUtilisateur]);
    await magasin.fermerPourUtilisateur(req.session.idUtilisateur, req.sessionID);
    flash(req, 'succes', 'Mot de passe changé. Tes autres connexions ont été fermées.');
  }
  res.redirect('/compte#mot-de-passe');
});

routes.post('/compte/supprimer', async (req, res) => {
  if (!(await verifierActuel(req))) {
    flash(req, 'erreur', 'Mot de passe incorrect : le compte n’a pas été supprimé.');
    return res.redirect('/compte#supprimer');
  }
  const id = req.session.idUtilisateur;
  await requete('DELETE FROM users WHERE id_user = ?', [id]); // séries et révisions suivent (ON DELETE CASCADE)
  await magasin.fermerPourUtilisateur(id);
  evenement('info', 'Compte supprimé par son titulaire', { compte: id });
  req.session.destroy(() => {
    res.clearCookie('pharmat');
    res.render('message', { titre: 'Compte supprimé', symbole: 'circle-check', texte: 'Ton compte et tout ton historique ont été effacés. Bonne continuation.', lien: { href: '/', texte: 'Retour à l’accueil' }, utilisateur: null });
  });
});

export default routes;
