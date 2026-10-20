// En-têtes de sécurité, protection contre les requêtes intersites, limitation des tentatives,
// et gardes d'accès.
import helmet from 'helmet';

export const entetes = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      styleSrcAttr: ["'unsafe-inline'"], // largeurs des barres (--p) : sans risque d'exécution
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * Refuse une écriture (POST…) venue d'un autre site : le navigateur dit d'où vient la requête
 * (Sec-Fetch-Site, sinon Origin). Avec des cookies SameSite=Lax, cela remplace un jeton CSRF.
 */
export function verifierOrigine(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const site = req.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none' ? next() : refuser(res);
  const origine = req.get('origin') || req.get('referer');
  if (!origine) return next(); // ancien navigateur ou outil : pas d'en-tête, pas de cookie tiers
  try {
    return new URL(origine).host === req.get('host') ? next() : refuser(res);
  } catch {
    return refuser(res);
  }
}

function refuser(res) {
  res.status(403).render('erreur', { titre: 'Requête refusée', code: 403, message: "Cette action doit venir de Pharmat lui-même." });
}

/**
 * Limiteur en mémoire (un seul réplica) : au plus `max` essais par `fenetreMs` et par clé.
 * Retourne une fonction cle => vrai si l'essai est permis.
 */
export function limiteur(max, fenetreMs) {
  const essais = new Map();
  setInterval(() => {
    const seuil = Date.now() - fenetreMs;
    for (const [cle, liste] of essais) {
      const restants = liste.filter((t) => t > seuil);
      if (restants.length) essais.set(cle, restants);
      else essais.delete(cle);
    }
  }, fenetreMs).unref();
  return (cle) => {
    const seuil = Date.now() - fenetreMs;
    const liste = (essais.get(cle) || []).filter((t) => t > seuil);
    if (liste.length >= max) return false;
    liste.push(Date.now());
    essais.set(cle, liste);
    return true;
  };
}

export function exigerConnexion(req, res, next) {
  if (res.locals.utilisateur) return next();
  const retour = req.method === 'GET' ? `?retour=${encodeURIComponent(req.originalUrl)}` : '';
  res.redirect(`/connexion${retour}`);
}

export function exigerAdmin(req, res, next) {
  if (res.locals.utilisateur?.admin) return next();
  if (!res.locals.utilisateur) return exigerConnexion(req, res, next);
  res.status(403).render('erreur', { titre: 'Accès réservé', code: 403, message: "Cette page est réservée à l'administration." });
}

/** Une adresse de retour sûre : un chemin de ce site, jamais une autre origine. */
export function retourSur(chemin, defaut = '/accueil') {
  return typeof chemin === 'string' && /^\/(?![/\\])/.test(chemin) ? chemin : defaut;
}
