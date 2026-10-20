// Petites aides communes aux routes.

/** Message affiché une fois, à la page suivante. */
export function flash(req, type, texte) {
  req.session.flash = { type, texte };
}

/** Entier positif, ou null. */
export function entier(valeur) {
  const n = Number.parseInt(valeur, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Valeur d'un champ texte de formulaire, sans espaces superflus. */
export function texte(valeur, max = 1000) {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

/** Une liste depuis un champ répété (case à cocher) : toujours un tableau. */
export function liste(valeur) {
  if (valeur == null) return [];
  return Array.isArray(valeur) ? valeur : [valeur];
}

/** Recharge la session (nouvel identifiant) avant de la lier à un compte : pas de fixation. */
export function ouvrirSession(req, idUtilisateur) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((erreur) => {
      if (erreur) return reject(erreur);
      req.session.idUtilisateur = idUtilisateur;
      resolve();
    });
  });
}
