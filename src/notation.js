// Notation des questions, reprise de Pharmat 1 :
//  - QCS (une seule bonne réponse) : 2 points si juste, 0 sinon ;
//  - QCM (une ou plusieurs) : on compte les erreurs (case cochée à tort + bonne réponse oubliée) :
//    0 erreur → 2 points, 1 → 1, 2 → 0,4, au-delà → 0.
export const POINTS_MAX = 2;
export const LETTRES = ['A', 'B', 'C', 'D', 'E'];

/** « A,C » → ['A','C'] ; ignore tout ce qui n'est pas une lettre de A à E. */
export function lettres(texte) {
  if (Array.isArray(texte)) return normaliser(texte);
  return normaliser(String(texte ?? '').split(','));
}

/** Lettres uniques, en capitales, triées. */
export function normaliser(liste) {
  const ok = new Set(liste.map((l) => String(l).trim().toUpperCase()).filter((l) => LETTRES.includes(l)));
  return LETTRES.filter((l) => ok.has(l));
}

export function erreurs(type, correctes, donnees) {
  if (type === 'QCS') return donnees.length === 1 && donnees[0] === correctes[0] ? 0 : 1;
  const aTort = donnees.filter((l) => !correctes.includes(l)).length;
  const oubliees = correctes.filter((l) => !donnees.includes(l)).length;
  return aTort + oubliees;
}

export function points(type, nbErreurs) {
  if (type === 'QCS') return nbErreurs === 0 ? 2 : 0;
  return [2, 1, 0.4][nbErreurs] ?? 0;
}

/** Note une réponse : { erreurs, points }. Sans réponse : 0 point. */
export function noter(type, correct, reponse) {
  const correctes = lettres(correct);
  const donnees = lettres(reponse);
  if (donnees.length === 0) return { erreurs: correctes.length || 1, points: 0 };
  const n = erreurs(type, correctes, donnees);
  return { erreurs: n, points: points(type, n) };
}

/** Taux de réussite en pour cent (0-100), ou null s'il n'y a rien à noter. */
export function taux(score, nbQuestions) {
  if (!nbQuestions) return null;
  return Math.round((score / (nbQuestions * POINTS_MAX)) * 100);
}

/** Niveau qualitatif d'un taux, pour les couleurs : bon, moyen, faible. */
export function niveau(pourcent) {
  if (pourcent == null) return 'neutre';
  if (pourcent >= 70) return 'bon';
  if (pourcent >= 45) return 'moyen';
  return 'faible';
}

/** Arrondi d'un score affiché (0,4 points s'additionnent mal en flottants). */
export function arrondi(score) {
  return Math.round(Number(score) * 100) / 100;
}
