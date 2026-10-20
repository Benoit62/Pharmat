// Dates à l'heure de Paris, quel que soit le fuseau du conteneur (UTC sur le serveur).
import { config } from './config.js';

const jourParis = new Intl.DateTimeFormat('en-CA', { timeZone: config.fuseau, year: 'numeric', month: '2-digit', day: '2-digit' });
const dateLongue = new Intl.DateTimeFormat('fr-FR', { timeZone: config.fuseau, day: 'numeric', month: 'long', year: 'numeric' });
const dateCourte = new Intl.DateTimeFormat('fr-FR', { timeZone: config.fuseau, day: 'numeric', month: 'short' });
const jourSemaine = new Intl.DateTimeFormat('fr-FR', { timeZone: config.fuseau, weekday: 'short' });

/** « AAAA-MM-JJ » du jour (ou de la date donnée) à Paris. */
export function jour(date = new Date()) {
  return jourParis.format(date);
}

/** Une date « AAAA-MM-JJ » (colonne DATE) ou un Date → objet Date à midi UTC ce jour-là. */
function versDate(valeur) {
  if (valeur instanceof Date) return valeur;
  return new Date(`${String(valeur).slice(0, 10)}T12:00:00Z`);
}

/** Nombre de jours entre deux « AAAA-MM-JJ » (b − a). */
export function ecartJours(a, b) {
  return Math.round((versDate(b) - versDate(a)) / 86400e3);
}

/** Les n derniers jours, du plus ancien à aujourd'hui, en « AAAA-MM-JJ ». */
export function derniersJours(n) {
  const liste = [];
  for (let i = n - 1; i >= 0; i--) liste.push(jour(new Date(Date.now() - i * 86400e3)));
  return liste;
}

export const format = {
  date: (v) => (v ? dateLongue.format(typeof v === 'string' ? versDate(v) : v) : '—'),
  court: (v) => (v ? dateCourte.format(typeof v === 'string' ? versDate(v) : v) : '—'),
  jourSemaine: (v) => jourSemaine.format(versDate(v)).replace('.', ''),
  duree(secondes) {
    if (secondes == null) return '—';
    if (secondes < 60) return `${secondes} s`;
    const h = Math.floor(secondes / 3600);
    const m = Math.round((secondes % 3600) / 60);
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
  },
  nombre: (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n ?? 0),
};

/** Jours d'affilée avec au moins une activité, en finissant aujourd'hui ou hier. */
export function serieDeJours(joursActifs) {
  const actifs = new Set(joursActifs);
  let curseur = jour();
  if (!actifs.has(curseur)) curseur = jour(new Date(Date.now() - 86400e3));
  let n = 0;
  while (actifs.has(curseur)) {
    n++;
    curseur = jour(new Date(versDate(curseur).getTime() - 86400e3));
  }
  return n;
}
